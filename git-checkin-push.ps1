# Check-in and push to GitHub
# Run in Cursor: Terminal -> New Terminal, then: .\git-checkin-push.ps1

Set-Location $PSScriptRoot

Write-Host "=== Git status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Staging all changes ===" -ForegroundColor Cyan
git add -A

Write-Host "`n=== Commit ===" -ForegroundColor Cyan
$message = @"
Watch history, resume playback, and fixes

- Add Watch History sidebar and page with resume
- Persist and resume playback position (video window seek + progress reporting)
- Rust: Emitter import, Payload Clone, report_playback_progress
- Detail.tsx: fix ep scope for series extension in watch history
- Settings: Clear content cache option
- Initial categories load progress bar in Layout
"@
git commit -m $message

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Push to origin ===" -ForegroundColor Cyan
    $branch = git rev-parse --abbrev-ref HEAD
    git push origin $branch
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nDone. Code pushed to origin/$branch" -ForegroundColor Green
    } else {
        Write-Host "`nPush failed. Check remote and try: git push origin $branch" -ForegroundColor Yellow
    }
} else {
    Write-Host "`nNothing to commit or commit failed." -ForegroundColor Yellow
}
