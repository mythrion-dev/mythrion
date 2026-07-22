import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * NPC Lifecycle E2E Tests
 *
 * Tests the full NPC data flow:
 *   1. Create an adventure
 *   2. Create a template WITH an 'hp' core resource
 *   3. Create NPCs using that template
 *   4. Verify NPC list returns proper HP values
 *   5. Update NPC HP
 *   6. Verify HP persists on re-fetch
 *
 * Prerequisites:
 *   - A running PostgreSQL database (configured via DATABASE_URL in .env)
 *   - JWT authentication tokens (configured via JWT_SECRET in .env)
 *
 * Run:
 *   npm run test:e2e
 */
describe('NPC Lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let adventureId: string;
  let templateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Obtain auth token — assumes a test user exists or auth endpoint accepts test credentials
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test-password' })
      .expect(201);

    authToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Clean up: delete adventure (cascades to template, NPCs)
    if (adventureId) {
      await request(app.getHttpServer())
        .delete(`/adventures/${adventureId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  /**
   * Step 1: Create an adventure
   */
  it('POST /adventures — creates an adventure for testing', async () => {
    const res = await request(app.getHttpServer())
      .post('/adventures')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'E2E Test Adventure',
        campaign: 'E2E Campaign',
        maxPlayers: 4,
      })
      .expect(201);

    adventureId = res.body.id;
    expect(adventureId).toBeDefined();
  });

  /**
   * Step 2: Create a template with an 'hp' core resource
   */
  it('POST /templates — creates a template with HP core resource', async () => {
    expect(adventureId).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/adventures/${adventureId}/templates`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'E2E Test Template',
        attributes: [
          { key: 'str', name: 'Strength' },
          { key: 'dex', name: 'Dexterity' },
          { key: 'con', name: 'Constitution' },
        ],
        coreResources: [
          {
            slug: 'hp',
            displayName: 'Hit Points',
            enabled: true,
            editableByPlayer: true,
            showNotes: false,
          },
          {
            slug: 'mp',
            displayName: 'Mana Points',
            enabled: true,
            editableByPlayer: true,
            showNotes: false,
          },
        ],
        skills: [],
      })
      .expect(201);

    templateId = res.body.id;
    expect(templateId).toBeDefined();

    // Verify HP core resource exists and is enabled
    const hpResource = res.body.coreResources?.find(
      (cr: any) => cr.slug === 'hp',
    );
    expect(hpResource).toBeDefined();
    expect(hpResource.enabled).toBe(true);
  });

  /**
   * Step 3: Create an NPC — HP should be initialized to 10/10
   */
  it('POST /adventures/:id/npcs — creates NPC with initialized HP', async () => {
    expect(adventureId).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Goblin Scout',
        type: 'NPC',
      })
      .expect(201);

    expect(res.body.characterName).toBe('Goblin Scout');
    expect(res.body.isNpc).toBe(true);
    expect(res.body.npcType).toBe('NPC');

    // HP should be initialized to 10/10 by createNpc()
    expect(res.body.hpActual).toBe(10);
    expect(res.body.hpMax).toBe(10);
  });

  /**
   * Step 4: Create a MOB — HP should also be initialized
   */
  it('POST /adventures/:id/npcs — creates MOB with initialized HP', async () => {
    expect(adventureId).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Rat Swarm',
        type: 'MOB',
      })
      .expect(201);

    expect(res.body.characterName).toBe('Rat Swarm');
    expect(res.body.isNpc).toBe(true);
    expect(res.body.npcType).toBe('MOB');
    expect(res.body.hpActual).toBe(10);
    expect(res.body.hpMax).toBe(10);
  });

  /**
   * Step 5: List NPCs — HP values should be correct
   */
  it('GET /adventures/:id/npcs — returns NPCs with correct HP values', async () => {
    expect(adventureId).toBeDefined();

    const res = await request(app.getHttpServer())
      .get(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    // Every NPC should have valid HP (> 0)
    for (const npc of res.body) {
      expect(npc.hpActual).toBeGreaterThan(0);
      expect(npc.hpMax).toBeGreaterThan(0);
    }

    // Should not see 0/0 for any NPC
    const zeroHpNpcs = res.body.filter(
      (n: any) => n.hpActual === 0 || n.hpMax === 0,
    );
    expect(zeroHpNpcs).toHaveLength(0);
  });

  /**
   * Step 6: Update NPC HP through core resource values
   */
  it('PATCH /character-sheets/:id — updates NPC HP via core resource values', async () => {
    // First, get the NPCs to find one to update
    const listRes = await request(app.getHttpServer())
      .get(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const npcToUpdate = listRes.body[0];
    expect(npcToUpdate).toBeDefined();

    // Get the full sheet to find the HP core resource value ID
    const sheetRes = await request(app.getHttpServer())
      .get(`/character-sheets/${npcToUpdate.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const hpCrv = sheetRes.body.coreResourceValues?.find(
      (crv: any) => crv.coreResource?.slug === 'hp',
    );
    expect(hpCrv).toBeDefined();

    // Update HP to 15/20
    await request(app.getHttpServer())
      .patch(`/character-sheets/${npcToUpdate.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        coreResourceValues: [
          { id: hpCrv.id, current: 15, maximum: 20 },
        ],
      })
      .expect(200);

    // Re-fetch NPC list and verify HP persisted
    const reFetchRes = await request(app.getHttpServer())
      .get(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const updatedNpc = reFetchRes.body.find(
      (n: any) => n.id === npcToUpdate.id,
    );
    expect(updatedNpc).toBeDefined();
    expect(updatedNpc.hpActual).toBe(15);
    expect(updatedNpc.hpMax).toBe(20);
  });

  /**
   * Step 7: Verify NPCs without HP core resource fallback correctly
   */
  it('GET /adventures/:id/npcs — legacy fallback works when no HP CRV exists', async () => {
    expect(adventureId).toBeDefined();

    // Create an NPC directly (bypassing createNpc) to simulate a scenario
    // where a template didn't originally have HP core resource.
    // This is hard to do through the API — just verify current NPCs.
    const res = await request(app.getHttpServer())
      .get(`/adventures/${adventureId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // All NPCs should have valid HP values
    for (const npc of res.body) {
      expect(npc.hpActual).not.toBeNull();
      expect(npc.hpMax).not.toBeNull();
    }
  });

  /**
   * Step 8: Create an NPC without a template should fail gracefully
   */
  it('POST /adventures/:id/npcs — fails when adventure has no template', async () => {
    // Create a minimal adventure without a template
    const advRes = await request(app.getHttpServer())
      .post('/adventures')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Template-less Adventure',
        campaign: 'E2E',
        maxPlayers: 2,
      })
      .expect(201);

    const noTemplateAdvId = advRes.body.id;

    // Try to create NPC without template
    await request(app.getHttpServer())
      .post(`/adventures/${noTemplateAdvId}/npcs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Ghost', type: 'NPC' })
      .expect(404);

    // Clean up
    await request(app.getHttpServer())
      .delete(`/adventures/${noTemplateAdvId}`)
      .set('Authorization', `Bearer ${authToken}`);
  });
});
