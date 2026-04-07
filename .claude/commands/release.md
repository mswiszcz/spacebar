Prepare and publish a new release of Spacebar.

## Step 1: Assess changes

Run `git log --oneline $(git describe --tags --abbrev=0)..HEAD` to see all commits since the last release tag.

Determine the appropriate version bump based on conventional commit messages:
- **major**: any commit contains a breaking change (BREAKING CHANGE in body, or `!` after type)
- **minor**: any `feat:` commits
- **patch**: only `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `perf:`, `test:` commits

Read the current version from `package.json`. Calculate the new version. Show the user:
- The commits being included
- The determined bump level and new version number

Ask the user to confirm before proceeding.

## Step 2: Dispatch the release workflow

Run the GitHub Actions release workflow:

```
gh workflow run release.yml -f version=X.Y.Z
```

Then watch the run:

```
gh run watch
```

## Step 3: Confirm

Once the run completes, get the release URL:

```
gh release view vX.Y.Z --json url -q .url
```

Show the user the release URL and confirm everything completed successfully.
