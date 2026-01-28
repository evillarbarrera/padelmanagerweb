# Training Padel Academy - Web Version

Versión web (responsive) del sistema de gestión de clases para la academia de pádel. Diseño moderno tipo Nike Fitness.

## 🎨 Características

- **Autenticación de usuarios** con soporte para estudiantes y entrenadores
- **Dashboard para estudiantes** con estadísticas de clases
- **Dashboard para entrenadores** con gestión de alumnos
- **Sistema de reservas** de clases
- **Perfil de usuario** editable
- **Diseño Nike Fitness** moderno y responsivo
- **Animaciones fluidas** y experiencia de usuario mejorada

## 🚀 Requisitos

- Node.js 18+
- npm 9+
- Angular 20+

## 📥 Instalación

```bash
# Navegar a la carpeta del proyecto
cd training_web

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start
```

La aplicación se ejecutará en `http://localhost:4200`

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── services/
│   │   ├── auth.service.ts          # Autenticación
│   │   ├── mysql.service.ts         # Datos de usuario y perfil
│   │   ├── entrenamientos.service.ts # Disponibilidad y reservas
│   │   ├── packs.service.ts         # Packs de clases
│   │   └── alumno.service.ts        # Datos de alumnos (entrenador)
│   ├── pages/
│   │   ├── login/                   # Página de inicio de sesión
│   │   ├── jugador-home/            # Dashboard estudiante
│   │   ├── jugador-reservas/        # Mis reservas (estudiante)
│   │   ├── jugador-calendario/      # Agendar clases
│   │   ├── entrenador-home/         # Dashboard entrenador
│   │   ├── alumnos/                 # Lista de alumnos
│   │   └── perfil/                  # Perfil de usuario
│   ├── app.component.ts
│   ├── app.routes.ts                # Rutas de la aplicación
│   └── ...
├── assets/
├── index.html
├── main.ts
└── styles.scss
```

## 🔐 Autenticación

El sistema usa autenticación con usuario/contraseña contra la API en `http://api.lamatek.cl`

**Token de acceso**: `Bearer 1|padel_academy`

### Roles soportados:
- **jugador/alumno**: Acceso a dashboard de estudiante, mis reservas, agendar clases
- **entrenador**: Acceso a dashboard de entrenador, lista de alumnos, packs

## 🎯 Rutas Disponibles

### Para Estudiantes:
- `/login` - Inicio de sesión
- `/jugador-home` - Dashboard principal
- `/jugador-reservas` - Mis reservas
- `/jugador-calendario` - Agendar clases
- `/perfil` - Mi perfil

### Para Entrenadores:
- `/entrenador-home` - Dashboard principal
- `/alumnos` - Mi lista de alumnos
- `/perfil` - Mi perfil

## 🛠️ Build

Para crear una versión de producción:

```bash
npm run build
```

Los archivos compilados se encontrarán en `dist/training_web`

## 🌐 Despliegue

Para desplegar en Donweb o similar hosting:

1. Ejecutar `npm run build`
2. Copiar todo el contenido de `dist/training_web` al servidor web
3. Configurar el servidor para servir `index.html` para todas las rutas (SPA)

### Configuración .htaccess (Apache):
```
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## 🎨 Diseño

El proyecto utiliza un diseño moderno inspirado en Nike Fitness con:
- Colores: Negro (#0a0e27), Rojo (#ff6b6b), Amarillo (#ffd700), Verde (#4caf50)
- Gradientes y glassmorphism
- Animaciones suaves
- Responsive design para mobile y desktop

## 🔗 API Base URL

`http://api.lamatek.cl`

Todos los endpoints incluyen el header:
```
Authorization: Bearer 1|padel_academy
Content-Type: application/json
```

## 📝 Licencia

Privado - Training Padel Academy 2026

# PadelManagerWeb
