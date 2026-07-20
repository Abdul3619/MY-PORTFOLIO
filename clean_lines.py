with open('server.ts', 'r') as f:
    lines = f.readlines()

# find where app.get('/api/projects/:slug' is, which should be around 1265. Wait, let's just find the start of the second `/api/projects` and delete the junk before it.
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith("app.get('/api/projects/:slug', async (req, res) => {"):
        end_idx = i
    if line.strip() == "});" and end_idx == -1 and i > 1255:
        # looking for the first }); after our injected first route
        if 'catch (err: any)' in lines[i-3] or 'catch (err: any)' in lines[i-4]:
            start_idx = i + 1

print(f"start: {start_idx}, end: {end_idx}")

if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
    del lines[start_idx:end_idx]
    with open('server.ts', 'w') as f:
        f.writelines(lines)
    print("Cleaned up!")
