
import sys
import re

def check_range(file_path, start, end):
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    content = "".join(lines[start-1:end])
    all_tags = re.findall(r'<(/?[a-zA-Z0-9-]+)[^>]*>', content)
    
    stack = []
    for tag in all_tags:
        if tag.startswith('/'):
            tag_name = tag[1:]
            if not stack:
                print(f"Unexpected closing tag: {tag}")
                continue
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Mismatch: opened {last_tag}, closed {tag_name}")
        else:
            if tag in ['img', 'input', 'br', 'hr', 'meta', 'link']:
                continue
            stack.append(tag)
    
    if stack:
        print(f"Unclosed tags in range {start}-{end}: {stack}")
    else:
        print(f"Range {start}-{end} balanced!")

if __name__ == "__main__":
    check_range(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]))
