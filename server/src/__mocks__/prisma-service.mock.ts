/**
 * Mock factory for PrismaService.
 *
 * Provides two factory functions:
 * - `createMockPrismaService()` -- all model methods return sensible defaults.
 * - `createMockPrismaServiceWithData(initialData)` -- seeds data so that
 *   findUnique / findFirst / findMany actually query the provided records.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type MockModel = ReturnType<typeof mockModel>;

function mockModel() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn().mockResolvedValue({}),
    aggregate: jest.fn().mockResolvedValue({}),
  };
}

/**
 * Returns a mocked PrismaService where every model method is a `jest.fn()`
 * that returns sensible defaults (empty arrays for list queries, `null` for
 * scalar queries, empty objects for writes).
 *
 * Usage in NestJS tests:
 *
 * ```ts
 * const module = await Test.createTestingModule({
 *   providers: [
 *     MyService,
 *     { provide: PrismaService, useValue: createMockPrismaService() },
 *   ],
 * }).compile();
 * ```
 */
export function createMockPrismaService() {
  return {
    user: mockModel(),
    adventure: mockModel(),
    campaignMember: mockModel(),
    campaignInvitation: mockModel(),
    refreshToken: mockModel(),
    template: mockModel(),
    templateArmorClass: mockModel(),
    templateResistance: mockModel(),
    templateField: mockModel(),
    templateCoreResource: mockModel(),
    templateAttribute: mockModel(),
    templateSkill: mockModel(),
    templateCharacterSection: mockModel(),
    skillModifierProfile: mockModel(),
    profileOption: mockModel(),
    subscriptionPlan: mockModel(),
    userSubscription: mockModel(),
    subscriptionInvoice: mockModel(),
    characterSheet: mockModel(),
    characterSheetValue: mockModel(),
    characterSheetFieldValue: mockModel(),
    characterSheetSkillValue: mockModel(),
    characterSheetSkillProfileValue: mockModel(),
    characterSheetCoreResourceValue: mockModel(),
    characterSheetArmorClassValue: mockModel(),
    characterSheetArmorClassAttributeValue: mockModel(),
    characterSheetResistanceValue: mockModel(),
    characterSheetResistanceComponentValue: mockModel(),
    characterAbility: mockModel(),
    characterAbilityLevel: mockModel(),
    characterInventoryItem: mockModel(),
    characterStory: mockModel(),
    characterSectionEntry: mockModel(),
    sheetResistance: mockModel(),
    sheetResistanceComponent: mockModel(),
    sheetResistanceAttributeModifier: mockModel(),
    sheetProfessionalSkill: mockModel(),
    sheetProfessionalSkillProfileValue: mockModel(),
    summonSkill: mockModel(),
    summonSkillProfileValue: mockModel(),
    summonAttribute: mockModel(),
    summonArmorClassValue: mockModel(),
    summonArmorClassAttributeValue: mockModel(),
    summonHealth: mockModel(),
    summonResistanceValue: mockModel(),
    summonResistanceComponentValue: mockModel(),
    armorClassField: mockModel(),
    armorClassAttributeModifier: mockModel(),
    resistanceComponent: mockModel(),
    resistanceAttributeModifier: mockModel(),
    joinRequest: mockModel(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([{ total: 0, ids: [] }]),
    $transaction: jest.fn().mockImplementation((cb: any) =>
      typeof cb === 'function' ? cb(undefined) : Promise.resolve([]),
    ),
  };
}

/**
 * Creates a mocked PrismaService pre-seeded with `initialData`.
 *
 * `findUnique` matches on `where.id` (first match),
 * `findFirst` matches on `where.id` (first match),
 * `findMany` returns all records for the model (respects an optional
 * `where.id` filter).
 *
 * ```ts
 * const prisma = createMockPrismaServiceWithData({
 *   user: [
 *     { id: '1', email: 'a@b.com' },
 *     { id: '2', email: 'c@d.com' },
 *   ],
 *   adventure: [{ id: '10', title: 'Test' }],
 * });
 *
 * await prisma.user.findUnique({ where: { id: '1' } });
 * // => { id: '1', email: 'a@b.com' }
 *
 * await prisma.user.findMany();
 * // => [{ id: '1', email: 'a@b.com' }, { id: '2', email: 'c@d.com' }]
 * ```
 */
export function createMockPrismaServiceWithData(
  initialData: Record<string, Record<string, any>[]>,
) {
  // Deep-clone the seed data so tests don't mutate the original reference.
  const store: Record<string, any[]> = {};
  for (const [model, records] of Object.entries(initialData)) {
    store[model] = records.map((r) => ({ ...r }));
  }

  function seededModel(modelName: string): MockModel {
    const findUnique = jest.fn().mockImplementation(
      (args: { where?: { id?: string } } & Record<string, any>) => {
        if (!args?.where) return Promise.resolve(null);
        const record = (store[modelName] ?? []).find(
          (r) => r.id === args.where!.id,
        );
        return Promise.resolve(record ?? null);
      },
    );

    const findFirst = jest.fn().mockImplementation(
      (args: { where?: { id?: string } } & Record<string, any>) => {
        if (!args?.where) return Promise.resolve(null);
        const record = (store[modelName] ?? []).find(
          (r) => r.id === args.where!.id,
        );
        return Promise.resolve(record ?? null);
      },
    );

    const findMany = jest.fn().mockImplementation(
      (args?: { where?: { id?: string } } & Record<string, any>) => {
        let results = store[modelName] ?? [];
        if (args?.where?.id) {
          results = results.filter((r) => r.id === args.where!.id);
        }
        return Promise.resolve(results);
      },
    );

    const create = jest.fn().mockImplementation((args: { data: any }) => {
      const record = { ...args.data, id: args.data.id ?? crypto.randomUUID() };
      store[modelName] = [...(store[modelName] ?? []), record];
      return Promise.resolve(record);
    });

    const update = jest.fn().mockImplementation(
      (args: { where: { id: string }; data: any }) => {
        const idx = (store[modelName] ?? []).findIndex(
          (r) => r.id === args.where.id,
        );
        if (idx === -1) return Promise.resolve(null);
        const updated = { ...store[modelName][idx], ...args.data };
        store[modelName][idx] = updated;
        return Promise.resolve(updated);
      },
    );

    const updateMany = jest.fn().mockImplementation(
      (args: { where: Record<string, any>; data: any }) => {
        let count = 0;
        (store[modelName] ?? []).forEach((record, idx) => {
          const match = Object.entries(args.where).every(
            ([key, value]) => record[key] === value,
          );
          if (match) {
            store[modelName][idx] = { ...record, ...args.data };
            count++;
          }
        });
        return Promise.resolve({ count });
      },
    );

    const delete_ = jest.fn().mockImplementation(
      (args: { where: { id: string } }) => {
        const idx = (store[modelName] ?? []).findIndex(
          (r) => r.id === args.where.id,
        );
        if (idx === -1) return Promise.resolve(null);
        const [deleted] = store[modelName].splice(idx, 1);
        return Promise.resolve(deleted);
      },
    );

    const deleteMany = jest.fn().mockImplementation(
      (args?: { where?: Record<string, any> }) => {
        if (!args?.where || Object.keys(args.where).length === 0) {
          const count = store[modelName]?.length ?? 0;
          store[modelName] = [];
          return Promise.resolve({ count });
        }
        const before = store[modelName]?.length ?? 0;
        store[modelName] = (store[modelName] ?? []).filter((record) => {
          return !Object.entries(args.where!).every(
            ([key, value]) => record[key] === value,
          );
        });
        return Promise.resolve({ count: before - (store[modelName]?.length ?? 0) });
      },
    );

    const count = jest.fn().mockImplementation(
      (args?: { where?: Record<string, any> }) => {
        let results = store[modelName] ?? [];
        if (args?.where) {
          results = results.filter((record) =>
            Object.entries(args.where!).every(
              ([key, value]) => record[key] === value,
            ),
          );
        }
        return Promise.resolve(results.length);
      },
    );

    const upsert = jest.fn().mockImplementation(
      (args: { where: { id: string }; create: any; update: any }) => {
        const idx = (store[modelName] ?? []).findIndex(
          (r) => r.id === args.where.id,
        );
        if (idx === -1) {
          const record = { ...args.create, id: args.where.id };
          store[modelName] = [...(store[modelName] ?? []), record];
          return Promise.resolve(record);
        }
        const updated = { ...store[modelName][idx], ...args.update };
        store[modelName][idx] = updated;
        return Promise.resolve(updated);
      },
    );

    const aggregate = jest.fn().mockResolvedValue({});

    return {
      findUnique,
      findFirst,
      findMany,
      create,
      update,
      updateMany,
      delete: delete_,
      deleteMany,
      count,
      upsert,
      aggregate,
    };
  }

  const modelNames = [
    'user',
    'adventure',
    'campaignMember',
    'campaignInvitation',
    'refreshToken',
    'template',
    'templateArmorClass',
    'templateResistance',
    'templateField',
    'templateCoreResource',
    'templateAttribute',
    'templateSkill',
    'templateCharacterSection',
    'skillModifierProfile',
    'profileOption',
    'subscriptionPlan',
    'userSubscription',
    'subscriptionInvoice',
    'characterSheet',
    'characterSheetValue',
    'characterSheetFieldValue',
    'characterSheetSkillValue',
    'characterSheetSkillProfileValue',
    'characterSheetCoreResourceValue',
    'characterSheetArmorClassValue',
    'characterSheetArmorClassAttributeValue',
    'characterSheetResistanceValue',
    'characterSheetResistanceComponentValue',
    'characterAbility',
    'characterAbilityLevel',
    'characterInventoryItem',
    'characterStory',
    'characterSectionEntry',
    'sheetResistance',
    'sheetResistanceComponent',
    'sheetResistanceAttributeModifier',
    'sheetProfessionalSkill',
    'sheetProfessionalSkillProfileValue',
    'summonSkill',
    'summonSkillProfileValue',
    'summonAttribute',
    'summonArmorClassValue',
    'summonArmorClassAttributeValue',
    'summonHealth',
    'summonResistanceValue',
    'summonResistanceComponentValue',
    'armorClassField',
    'armorClassAttributeModifier',
    'resistanceComponent',
    'resistanceAttributeModifier',
    'joinRequest',
  ] as const;

  const service: Record<string, any> = {};

  for (const name of modelNames) {
    service[name] = seededModel(name);
  }

  service.$connect = jest.fn().mockResolvedValue(undefined);
  service.$disconnect = jest.fn().mockResolvedValue(undefined);
  service.$queryRawUnsafe = jest.fn().mockResolvedValue([{ 1: 1 }]);
  service.$queryRaw = jest.fn().mockResolvedValue([{ total: 0, ids: [] }]);
  service.$transaction = jest.fn().mockImplementation((cb: any) =>
    typeof cb === 'function' ? cb(undefined) : Promise.resolve([]),
  );

  return service as ReturnType<typeof createMockPrismaService>;
}
