---
name: sdlc-development-code-generation-assistant-claude-code
description: "Developer assistant powered by CodeMie and Claude-Code CLI (codemie-claude). Reads local design/checklist files (root/docs/design.md, root/docs/pr_checklist.md), executes codemie-claude via the terminal to generate code for https://github.com/utpal74/codemie-meetingnotes, pushes changes, and automatically opens a Pull Request on GitHub."
tools: Read, Bash
model: inherit
---

# SDLC Development & Code Generation Assistant (Claude-Code)

Developer assistant powered by CodeMie and Claude-Code CLI (codemie-claude). Reads local design/checklist files (root/docs/design.md, root/docs/pr_checklist.md), executes codemie-claude via the terminal to generate code for https://github.com/utpal74/codemie-meetingnotes, pushes changes, and automatically opens a Pull Request on GitHub.

## Instructions

1. Extract the user's message from the conversation context
2. Execute the command with the message
3. Return the response

**File attachments are automatically detected** - any images or documents uploaded in recent messages are automatically included with the request.

**ARGUMENTS**: "message"

**Command format:**
```bash
codemie assistants chat "8e837fa8-dbaf-491f-80ba-6b131ca282c5" "message"
```

## Examples

**Simple message:**
```bash
codemie assistants chat "8e837fa8-dbaf-491f-80ba-6b131ca282c5" "Help me with this task"
```

**ARGUMENTS**: "check this code" --file /path/to/your/script.py

**With file attachment:**
```bash
codemie assistants chat "8e837fa8-dbaf-491f-80ba-6b131ca282c5" "Analyze this code" --file "script.py"
```

**With multiple files:**
```bash
codemie assistants chat "8e837fa8-dbaf-491f-80ba-6b131ca282c5" "Review these files" --file "file1.png" --file "file2.py"
```