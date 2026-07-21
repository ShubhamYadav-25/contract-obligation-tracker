const [workspaceName = "workspace", commandName = "command"] = process.argv.slice(2);

console.log(
  `[${workspaceName}] ${commandName} is configured, but this application has not been implemented yet.`,
);
