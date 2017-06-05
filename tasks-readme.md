# What Mother Never Told You About Using Visual Studio Code 1.12.2 with .Net Core 1.1 and TypeScript 2.3

## Running multiple tasks example
```json
{
    "version": "0.1.0",
    "tasks": [
        {
            "taskName": "tsc",
            "command": "tsc",
            "args": ["-w"],
            "isShellCommand": true,
            "isBackground": true,
            "problemMatcher": "$tsc-watch"
        },
        {
            "taskName": "build",
            "command": "gulp",
            "args": ["build"],
            "isShellCommand": true
        }
    ]
}
```
## My failed attempt

```json
        {
            "taskName": "pre-build",
            "command": "tsc",
            "args": [],
            "isShellCommand": true,
            "isBackground": true,
            "problemMatcher": "$tsc-watch"
        },
```
## dotnet build /target:Resources;Compile
dotnet build /target:PreCompileScript

## possible help
https://medium.com/@levifuller/building-an-angular-application-with-asp-net-core-in-visual-studio-2017-visualized-f4b163830eaa