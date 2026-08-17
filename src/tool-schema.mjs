import {
  MAX_TOOL_ARGUMENT_BYTES,
  MAX_TOOL_ARGUMENT_DEPTH,
  MAX_TOOL_ARRAY_ITEMS,
  MAX_TOOL_OBJECT_KEYS,
  MAX_TOOL_STRING_BYTES
} from "./constants.mjs";

export function validateToolInput(schema, input) {
  const size = Buffer.byteLength(JSON.stringify(input), "utf8");
  if (size > MAX_TOOL_ARGUMENT_BYTES) {
    throw new Error("tool arguments exceed the local size limit");
  }
  validate(schema, input, "arguments", 0);
  return input;
}

function validate(schema, value, field, depth) {
  if (depth > MAX_TOOL_ARGUMENT_DEPTH) {
    throw new Error(`${field} is too deeply nested`);
  }
  if (schema.type === "object") {
    validateObject(schema, value, field, depth);
    return;
  }
  if (schema.type === "array") {
    validateArray(schema, value, field, depth);
    return;
  }
  if (schema.type === "string") {
    validateString(schema, value, field);
    return;
  }
  if (schema.type === "integer") {
    if (!Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) {
      throw new Error(`${field} must be an integer within the allowed range`);
    }
    return;
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
}

function validateObject(schema, value, field, depth) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const entries = Object.entries(value);
  const maximum = Math.min(schema.maxProperties ?? MAX_TOOL_OBJECT_KEYS, MAX_TOOL_OBJECT_KEYS);
  if (entries.length > maximum) {
    throw new Error(`${field} contains too many fields`);
  }
  for (const required of schema.required || []) {
    if (value[required] === undefined) {
      throw new Error(`${field}.${required} is required`);
    }
  }
  for (const [key, item] of entries) {
    const propertySchema = schema.properties?.[key];
    if (!propertySchema && schema.additionalProperties === false) {
      throw new Error(`${field}.${key} is not supported`);
    }
    const additionalSchema = typeof schema.additionalProperties === "object" ? schema.additionalProperties : null;
    if (propertySchema || additionalSchema) {
      validate(propertySchema || additionalSchema, item, `${field}.${key}`, depth + 1);
    }
  }
}

function validateArray(schema, value, field, depth) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  const maximum = Math.min(schema.maxItems ?? MAX_TOOL_ARRAY_ITEMS, MAX_TOOL_ARRAY_ITEMS);
  if (value.length > maximum) {
    throw new Error(`${field} contains too many items`);
  }
  value.forEach((item, index) => validate(schema.items || {}, item, `${field}[${index}]`, depth + 1));
}

function validateString(schema, value, field) {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > MAX_TOOL_STRING_BYTES || value.length > (schema.maxLength ?? Infinity)) {
    throw new Error(`${field} exceeds the allowed length`);
  }
  if (value.length < (schema.minLength ?? 0)) {
    throw new Error(`${field} is required`);
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    throw new Error(`${field} has an invalid format`);
  }
}
