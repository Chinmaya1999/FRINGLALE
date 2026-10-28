export const validate = (schema, part = 'body') => (req, _res, next) => {
  try {
    const parsed = schema.parse(req[part]);
    // Express 5 exposes req.query as a getter-only property, so redefine it instead of assigning.
    if (part === 'query') Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
    else req[part] = parsed;
    next();
  } catch (e) { next(e); }
};
