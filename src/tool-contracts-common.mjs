const IDENTIFIER_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$";

const TOOL_EFFECT_ANNOTATIONS = Object.freeze({
  read: Object.freeze({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }),
  additive: Object.freeze({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }),
  control: Object.freeze({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }),
  destructive: Object.freeze({
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true
  })
});

function annotationsFor(effect) {
  const annotations = TOOL_EFFECT_ANNOTATIONS[effect];
  if (!annotations) {
    throw new Error(`unsupported Swarm MCP tool effect: ${effect || "missing"}`);
  }
  return annotations;
}

export const identifier = (description) => ({
  type: "string",
  pattern: IDENTIFIER_PATTERN,
  maxLength: 255,
  description
});

export const boundedText = (description, maxLength = 16384) => ({
  type: "string",
  minLength: 1,
  maxLength,
  description
});

export const optionalText = (description, maxLength = 16384) => ({
  type: "string",
  maxLength,
  description
});

export const limit = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  default: 50,
  description: "Maximum records to return."
};

export const cursor = {
  type: "string",
  maxLength: 2048,
  description: "Opaque cursor returned by the previous page."
};

export const idempotencyKey = {
  type: "string",
  minLength: 8,
  maxLength: 255,
  description: "Stable caller-owned key reused for retries of this mutation."
};

export const resourceRef = {
  type: "object",
  additionalProperties: false,
  required: ["resource_type", "resource_id"],
  properties: {
    resource_type: identifier("Canonical resource type key."),
    resource_id: identifier("Canonical resource identifier.")
  }
};

export const encodedResourceRef = (description = "Canonical encoded resource reference.") => ({
  type: "string",
  minLength: 3,
  maxLength: 512,
  description
});

export const conversationLinkRef = {
  type: "object",
  additionalProperties: false,
  required: ["role_key", "resource_ref"],
  properties: {
    role_key: identifier("Registered conversation link role key."),
    resource_ref: encodedResourceRef()
  }
};

export const booleanValue = (description) => ({ type: "boolean", description });

export const integerValue = (description, minimum = 0, maximum = 2147483647) => ({
  type: "integer",
  minimum,
  maximum,
  description
});

export const stringArray = (description, maxItems = 64) => ({
  type: "array",
  maxItems,
  items: identifier(description),
  description
});

export const objectValue = (description, maxProperties = 64) => ({
  type: "object",
  maxProperties,
  additionalProperties: true,
  description
});

export function inputSchema(properties = {}, required = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {})
  };
}

export function readContract({ name, title, description, path, properties = {}, required = [], pathParams = {}, queryParams = {}, defaultSpace = false }) {
  return {
    name,
    title,
    description,
    method: "GET",
    path,
    pathParams,
    queryParams,
    defaultSpace,
    effect: "read",
    annotations: annotationsFor("read"),
    inputSchema: inputSchema(properties, required)
  };
}

export function mutationContract({
  name,
  title,
  description,
  method = "POST",
  path,
  commandKey,
  capabilityKey,
  effect,
  properties = {},
  required = [],
  pathParams = {},
  queryParams = {},
  bodyParams = [],
  defaultSpace = false
}) {
  return {
    name,
    title,
    description,
    method,
    path,
    commandKey,
    capabilityKey,
    effect,
    annotations: annotationsFor(effect),
    pathParams,
    queryParams,
    bodyParams,
    defaultSpace,
    inputSchema: inputSchema(
      { ...properties, idempotency_key: idempotencyKey },
      [...required, "idempotency_key"]
    )
  };
}

export const pageProperties = { limit, cursor };
