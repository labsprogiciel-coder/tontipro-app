module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      // @supabase/supabase-js optionally loads @opentelemetry/api via a dynamic
      // import() tagged with /* webpackIgnore: true */, which Metro preserves
      // verbatim and Hermes cannot compile. Replace any such call with
      // Promise.resolve(null) so the optional-tracing path becomes a no-op.
      function replaceWebpackIgnoreImports({ types: t }) {
        return {
          visitor: {
            ImportExpression(path) {
              const leadingComments = path.node.source.leadingComments || [];
              if (leadingComments.some((c) => c.value.includes('webpackIgnore'))) {
                path.replaceWith(
                  t.callExpression(
                    t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
                    [t.nullLiteral()]
                  )
                );
              }
            },
          },
        };
      },
    ],
  };
};

