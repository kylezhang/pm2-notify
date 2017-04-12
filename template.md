## <%= process.name %> <%= process.NODE_ENV %> <%= event %>
- ProcessName: `<%= process.name %>`, ProcessId: `<%= process.pm_id %>`
- Error Time: `<%= date %>`
- Up Time: `<%= process.pm_uptime %>`
- Restart Count: `<%= process.restart_time %>`
- Executable: `<%= process.pm_exec_path %>`
- Standard Log Path: `<%= process.pm_out_log_path %>`
- Error Log Path: `<%= process.pm_err_log_path %>`