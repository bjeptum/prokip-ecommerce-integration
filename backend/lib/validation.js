const { z } = require('zod');

const setupSchema = z.object({
  platform: z.string().min(1),
  choice: z.enum(['pull', 'push']),
});

const platformBodySchema = z.object({
  platform: z.string().min(1),
});

const pushSchema = z.object({
  price_shirt1: z.string().optional(),
  image_shirt1: z.string().optional(),
});

const webhookSchema = z.object({
  orderId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
  status: z.enum(['completed', 'refunded']),
});

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(', ');
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
  }
  return result.data;
}

module.exports = {
  setupSchema,
  platformBodySchema,
  pushSchema,
  webhookSchema,
  validate,
};










