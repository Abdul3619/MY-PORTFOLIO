import re

with open('server.ts', 'r') as f:
    content = f.read()

# I will find the block starting with // Projects Routes
# and ending at the end of the /api/projects/:slug route
# The next route is /api/projects (POST) or something? Let's check what's after /api/projects/:slug
