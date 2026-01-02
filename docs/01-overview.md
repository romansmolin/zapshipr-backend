# Обзор проекта

ZapShipr Backend — это серверная часть платформы для управления публикациями в социальных сетях. Система позволяет пользователям создавать посты и публиковать их одновременно на нескольких платформах: Facebook, Instagram, LinkedIn, X (Twitter), TikTok, YouTube, Pinterest, Bluesky и Threads.

## Технологический стек

- **Runtime**: Node.js с TypeScript
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL с Drizzle ORM
- **Queue System**: BullMQ с Redis (ioredis)
- **Authentication**: JWT + Google OAuth
- **Storage**: AWS S3 (для медиа-файлов)
- **Media Processing**: Sharp (изображения), fluent-ffmpeg (видео)
- **Validation**: Zod
- **HTTP Client**: Axios

## Основные возможности

- Многоплатформенная публикация постов
- Управление аккаунтами социальных сетей
- Планирование публикаций
- Обработка медиа-файлов (изображения и видео)
- Аутентификация через email/password и Google OAuth
- Фоновая обработка задач через очереди
- AI-генерация контента

