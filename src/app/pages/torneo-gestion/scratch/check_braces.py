
def check_braces(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if not stack:
                print(f"Excess closing brace at index {i}")
                return False
            stack.pop()
    
    if stack:
        for pos in stack:
            print(f"Unclosed opening brace at index {pos}")
        return False
    
    print("Braces are balanced")
    return True

check_braces('/Users/ejvillarb/Documents/privado Emmanuel Villar/proyectos/training_padel_academy/training_web/src/app/pages/torneo-gestion/torneo-gestion.component.ts')
