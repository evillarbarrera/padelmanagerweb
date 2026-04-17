
import sys
import re

def check_html_balance(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Regex for tags, handles multi-line
    tags = re.finditer(r'<(/?[a-zA-Z0-9-]+)([^>]*)>', content, re.DOTALL)
    
    stack = []
    lines = content.splitlines()
    
    def get_line_num(pos):
        return content.count('\n', 0, pos) + 1

    for match in tags:
        tag_full = match.group(0)
        tag_name = match.group(1)
        pos = match.start()
        line_num = get_line_num(pos)
        
        if tag_name.startswith('/'):
            tag_name = tag_name[1:]
            if not stack:
                print(f"L{line_num}: Unexpected closing tag </{tag_name}>")
                continue
            last_tag, last_line = stack.pop()
            if last_tag != tag_name:
                print(f"L{line_num}: Mismatch! Closed </{tag_name}> but expected </{last_tag}> (opened at L{last_line})")
                # To keep going, we can try to find the matching tag in stack
        else:
            # Self-closing or void tags
            if tag_name in ['img', 'input', 'br', 'hr', 'meta', 'link', 'app-sidebar']:
                # Note: app-sidebar is used with a closing tag in this project, but we skip it if it's treated as void
                # Actually, in the file it has </app-sidebar>, so we SHOULD NOT skip it.
                if tag_name == 'app-sidebar' and '</app-sidebar>' in content:
                    stack.append((tag_name, line_num))
                continue
            
            # Check if self-closing <tag />
            if tag_full.endswith('/>'):
                continue
                
            stack.append((tag_name, line_num))
    
    if stack:
        print("\n=== UNCLOSED TAGS ===")
        for tag, line in stack:
            print(f"<{tag}> at L{line}")

if __name__ == "__main__":
    check_html_balance(sys.argv[1])
