# 每 7 天新增两部作品

使用 Windows 计划任务 `GalgameTracker-Weekly2` 调用本机已登录的 Codex CLI。首次计划为 **2026-10-16 09:00 Australia/Sydney（UTC+11）**，此后间隔 7 天。不依赖新付费 API、邮件服务或服务器；会消耗现有 ChatGPT/Codex 额度。

电脑需开机、联网且此 Windows 用户已登录；无需打开终端。关机或离线期间无法执行，任务配置允许恢复可用后补跑。未保存 Windows 密码，不以管理员身份执行。任务最长运行 6 小时，同一时刻只允许一个实例。已有 Codex、GitHub 和 Cloudflare 登录必须保持有效。

运行入口为 `scripts/run-weekly-update.ps1`，内容要求在 [weekly-update-prompt.md](weekly-update-prompt.md)。每次基于远端 main 创建独立 worktree，核对来源后逐部提交，通过检查再发布。存在分歧、额度不足、登录失效、自动审批拒绝或未通过测试时停止并记录；不会为凑数量伪造攻略，也不保证每次都能成功发布两部。文献核对不能代替实机通关。

结果保存在 `.local/weekly-updates/latest.json`，逐次报告和日志在同目录。`published` 表示两部均发布，`partial` 表示只完成部分，`blocked` 表示需要处理问题。此任务是 Windows 计划任务，不是 Codex 内置自动化，也不会自动向本聊天推送消息。

`scheduled` 表示尚未到首次执行时间，`running` 表示更新进行中。本周期已成功完成的运行会跳过，避免重复新增；独立 worktree 和每次结果日志会保留以便检查。

管理命令（在项目目录 PowerShell 中运行）：

```powershell
# 只检查环境，不调用模型、不修改网站
powershell.exe -NoProfile -File scripts/run-weekly-update.ps1 -CheckOnly

# 查看下一次运行及上次退出码（0 成功；1 阻塞；2 部分完成）
Get-ScheduledTaskInfo -TaskName GalgameTracker-Weekly2

# 暂停 / 恢复
Disable-ScheduledTask -TaskName GalgameTracker-Weekly2
Enable-ScheduledTask -TaskName GalgameTracker-Weekly2

# 读取最近一次报告
Get-Content .local/weekly-updates/latest.json -Encoding UTF8
```

重新安装时使用 `scripts/install-weekly-update.ps1 -FirstRun '2026-10-16T09:00:00+11:00'`（之后重装应改成未来日期）。预检通过只代表本机入口和登录可用；第一次完整内容更新要到计划执行后才可验证。

实现依据：[Codex 非交互执行文档](https://learn.chatgpt.com/docs/non-interactive-mode)。自动执行保留 `--approve-for-me` 的审批审查，不关闭安全检查，也不使用 API key 付费回退。
