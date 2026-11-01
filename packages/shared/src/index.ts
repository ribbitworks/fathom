// SPDX-License-Identifier: Apache-2.0

// Schemas and types shared by the front end and the server, so both agree on what the API sends.
// Only code that is safe to reach the browser belongs here.

export {
  type Account,
  accountActiveSchema,
  accountListSchema,
  accountRolesSchema,
  accountSchema,
  newAccountSchema,
  type NewAccountRequest,
  passwordChangeSchema,
  type PasswordChangeRequest,
  passwordLength,
  passwordResetSchema,
} from "./accounts.ts";
export {
  type Permission,
  permissionSchema,
  type Role,
  roleSchema,
  type Tier,
  tierSchema,
} from "./access.ts";
export {
  type AccessAction,
  accessActionSchema,
  type HistoryDetails,
  historyDetailsSchema,
  type HistoryEntry,
  historyEntrySchema,
  historyListSchema,
} from "./history.ts";
export {
  type Choice,
  type ChoiceRequest,
  choiceMoveSchema,
  choiceRequestSchema,
  choiceSchema,
  choicesRequestSchema,
  type List,
  listLengths,
  type ListRequest,
  listRequestSchema,
  listSchema,
  listsSchema,
  type RetiredRequest,
  retiredRequestSchema,
} from "./lists.ts";
export {
  changeSetIdSchema,
  columnKeySchema,
  type Field,
  type FieldRequest,
  fieldMoveSchema,
  fieldRequestSchema,
  fieldSchema,
  type Person,
  type PersonChange,
  type PersonRequest,
  peopleRequestSchema,
  peopleSchema,
  personChangeSchema,
  personLengths,
  personRequestSchema,
  personSchema,
  type Saved,
  savedSchema,
} from "./people.ts";
export {
  type Filter,
  filterSchema,
  type SavedView,
  type SavedViewChange,
  savedViewChangeSchema,
  type SavedViewRequest,
  savedViewRequestSchema,
  savedViewSchema,
  type ViewDefinition,
  viewColumnKeys,
  viewDefinitionSchema,
  viewLengths,
} from "./views.ts";
export { type GreetingResponse, greetingResponseSchema } from "./greeting.ts";
export {
  type SessionResponse,
  sessionResponseSchema,
  type SignInRequest,
  signInRequestSchema,
} from "./session.ts";
