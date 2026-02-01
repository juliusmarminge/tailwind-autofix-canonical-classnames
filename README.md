# Tailwind Canonical Classes Autofix

Auto-fix Tailwind CSS canonical class suggestions on save. This extension listens for Tailwind CSS IntelliSense diagnostics that say:

```
The class `...` can be written as `...`
```

and replaces the class with its canonical form before save.

## Requirements

- Install the official Tailwind CSS IntelliSense extension.
- Enable `tailwindCSS.lint.suggestCanonicalClasses` in your settings.

## Settings

- `tailwindCanonicalClasses.fixOnSave`: Enable/disable applying canonical class fixes on save. Default: `true`.

## Notes

- Fixes are computed from diagnostics, so a file must be fully analyzed by Tailwind CSS IntelliSense before save.
