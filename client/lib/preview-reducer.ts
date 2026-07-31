/**
 * Reducer for Template Preview (Sandbox Mode) state.
 * All state is local — dispatched actions update the flat maps directly.
 */

import type { PreviewSheetState, PreviewAction } from './preview-types'

export function previewReducer(state: PreviewSheetState, action: PreviewAction): PreviewSheetState {
  switch (action.type) {
    case 'INIT':
      return action.payload

    case 'SET_CHARACTER_NAME':
      return { ...state, characterName: action.payload }

    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload }

    case 'SET_LEVEL':
      return { ...state, level: action.payload }

    case 'SET_ATTRIBUTE_VALUE':
      return {
        ...state,
        attributeValues: {
          ...state.attributeValues,
          [action.attributeId]: action.value,
        },
      }

    case 'SET_FIELD_VALUE':
      return {
        ...state,
        fieldValues: {
          ...state.fieldValues,
          [action.fieldId]: action.value,
        },
      }

    case 'SET_SKILL_VALUE':
      return {
        ...state,
        skillValues: {
          ...state.skillValues,
          [action.skillId]: action.value,
        },
      }

    case 'SET_SKILL_ATTRIBUTE':
      return {
        ...state,
        skillAttributes: {
          ...state.skillAttributes,
          [action.skillId]: action.attributeId,
        },
      }

    case 'SET_PROFILE_SELECTION': {
      const currentSelections = state.profileSelections[action.skillId] ?? {}
      return {
        ...state,
        profileSelections: {
          ...state.profileSelections,
          [action.skillId]: {
            ...currentSelections,
            [action.profileId]: action.optionId,
          },
        },
      }
    }

    case 'SET_RESOURCE': {
      const current = state.coreResources[action.resourceId] ?? { current: null, maximum: null, notes: null }
      return {
        ...state,
        coreResources: {
          ...state.coreResources,
          [action.resourceId]: { ...current, ...action.resource },
        },
      }
    }

    case 'SET_AC_FIELD':
      return {
        ...state,
        acFieldValues: {
          ...state.acFieldValues,
          [action.fieldId]: action.value,
        },
      }

    case 'SET_AC_ATTRIBUTE_MODIFIER':
      return {
        ...state,
        acAttributeModifiers: {
          ...state.acAttributeModifiers,
          [action.modifierId]: action.attributeId,
        },
      }

    case 'SET_RESISTANCE_COMPONENT':
      return {
        ...state,
        resistanceComponents: {
          ...state.resistanceComponents,
          [action.componentId]: action.value,
        },
      }

    case 'SET_RESISTANCE_MANUAL':
      return {
        ...state,
        resistanceManualValues: {
          ...state.resistanceManualValues,
          [action.resistanceId]: action.value,
        },
      }

    case 'SET_ACTIVE_SKILLS':
      return { ...state, activeSkills: action.payload }

    case 'SET_OTHERS_VALUES':
      return { ...state, othersValues: action.payload }

    case 'UPDATE_ABILITIES':
      return { ...state, abilities: action.payload }

    case 'UPDATE_INVENTORY':
      return { ...state, inventoryItems: action.payload }

    case 'UPDATE_STORY':
      return { ...state, story: action.payload }

    case 'UPDATE_SECTION_ENTRIES':
      return { ...state, sectionEntries: action.payload }

    case 'SET_PROFESSIONAL_SKILLS':
      return { ...state, professionalSkills: action.payload }

    case 'RESET':
      return action.payload

    default:
      return state
  }
}
