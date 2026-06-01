#!/usr/bin/env bash
# PreToolUse hook: injects conventions + relevant module spec into context.
# Receives the full tool-call JSON on stdin (Claude Code hook contract).

input=$(cat 2>/dev/null) || input=""
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || file_path=""

conventions=$(cat docs/conventions.md 2>/dev/null) || conventions=""
spec=""
spec_label=""

find_spec() {
  local domain="$1"

  # Aliases: feature/page domain → spec file name.
  # Add project-specific aliases here as needed.
  case "$domain" in
    # Example aliases (uncomment or add your own):
    # agreements)   domain="engagements" ;;
    # orders)       domain="billing" ;;
    #
    # Page-based aliases — prefix globs roll sub-pages up to their module:
    # invoicedetail)  domain="billing" ;;
    # dealdetail|leaddetail|companydetail) domain="crm" ;;
  esac

  local base="docs/spec/modules"

  if [ -f "${base}/${domain}.md" ]; then
    spec=$(cat "${base}/${domain}.md")
    spec_label="${base}/${domain}.md"
  elif [ -d "${base}/${domain}" ]; then
    # Multi-file spec (e.g. crm/) — concatenate all .md files
    spec=$(find "${base}/${domain}" -name "*.md" -type f | sort | xargs cat 2>/dev/null) || spec=""
    spec_label="${base}/${domain}/"
  fi
}

if [ -n "$file_path" ]; then
  domain=""

  # src/features/DOMAIN/... — most reliable signal
  if [[ "$file_path" =~ src/features/([^/]+) ]]; then
    domain="${BASH_REMATCH[1]}"
  # src/pages/XxxPage.jsx → lowercase "Xxx"
  elif [[ "$file_path" =~ src/pages/([A-Z][a-zA-Z]+)(Page|Layout) ]]; then
    domain=$(printf '%s' "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')
  fi

  [ -n "$domain" ] && find_spec "$domain"
fi

context="=== Project Conventions (docs/conventions.md) ===
${conventions}"

if [ -n "$spec" ]; then
  context="${context}

=== Module Spec (${spec_label}) ===
${spec}"
elif [ -n "$domain" ]; then
  context="${context}

=== INSTRUCTION ===
No spec was found for the \"${domain}\" module.
Before making any edits, ask the user one of the following:
- \"Could you @ a file or paste some context so I understand this area?\"
- Or confirm: \"Is this a new feature with no docs yet?\"
Wait for their answer before proceeding."
fi

printf '%s' "$context" | jq -Rs '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: .}}'
