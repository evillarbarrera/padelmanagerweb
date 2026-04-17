
import sys
import re

def check_html_balance(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    stack = []
    # Match tags and keep track of line numbers
    for i, line in enumerate(lines):
        line_num = i + 1
        # Find all tags in line
        all_tags = re.findall(r'<(/?[a-zA-Z0-9-]+)[^>]*>', line)
        for tag in all_tags:
            if tag.startswith('/'):
                tag_name = tag[1:]
                if not stack:
                    print(f"L{line_num}: Unexpected closing tag </{tag_name}>")
                    continue
                last_tag, start_line = stack.pop()
                if last_tag != tag_name:
                    print(f"L{line_num}: Mismatch! Closed </{tag_name}> but expected </{last_tag}> (opened at L{start_line})")
            else:
                if tag in ['img', 'input', 'br', 'hr', 'meta', 'link', 'app-sidebar']:
                    continue
                stack.append((tag, line_num))
    
    if stack:
        for tag, line in stack:
            print(f"STAYED OPEN: <{tag}> at L{line}")

if __name__ == "__main__":
    check_html_balance(sys.argv[1])
