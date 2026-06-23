# Forge App

This Forge app mounts the shared ProxyTrace console inside a Jira issue panel. The active Custom UI bundle comes from `../frontend-v2/dist`, which is the same build the standalone dashboard uses.

See [developer.atlassian.com/platform/forge/](https://developer.atlassian.com/platform/forge) for documentation and tutorials explaining Forge.

## Requirements

See [Set up Forge](https://developer.atlassian.com/platform/forge/set-up-forge/) for instructions to get set up.

## Quick start

- Install top-level dependencies:
```
npm install
```

- Modify the issue-panel UI in `../frontend-v2/src/pages/JiraPanelApp.tsx` or the shared console components it uses.

- Build the shared frontend bundle:
```
cd ../frontend-v2
npm install
npm run build
```

- Deploy the Forge wrapper:
```
cd ../forge-app
forge deploy
```

- Install your app in an Atlassian site by running:
```
forge install
```

### Notes
- Use the `forge deploy` command when you want to persist code changes.
- Use the `forge install` command when you want to install the app on a new site.
- Once the app is installed on a site, the site picks up the new app changes you deploy without needing to rerun the install command.
- `static/hello-world` is a legacy sandbox from the initial Forge spike and is not referenced by the current `manifest.yml`.

## Support

See [Get help](https://developer.atlassian.com/platform/forge/get-help/) for how to get help and provide feedback.
