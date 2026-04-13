# 프로젝트 문서

이 디렉토리는 프로젝트의 전반적인 기획, 설계, 명세 문서를 관리합니다.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [서비스 기획서](./01_service_overview.md) | 프로젝트 개요, 핵심 기능, 요구사항 정의 |
| [시스템 아키텍처](./02_architecture.md) | 전체 시스템 구조, 기술 스택, 서비스 간 통신 |
| [ERD](./03_erd.md) | 데이터베이스 스키마 설계 |
| [API 명세서](./04_api_spec.md) | REST API 엔드포인트 정의 |
| [개발 환경 설정](./05_dev_setup.md) | 로컬 개발 환경 구축 가이드 |

## 프로젝트 구조

```
S14P31F104/
├── front/     # React 프론트엔드
├── back/      # Node.js + TypeScript + Express 백엔드
├── ai/        # Python AI 서버
└── docs/      # 프로젝트 문서 (현재 디렉토리)
```

## 팀 구성

| 역할 | 인원 | 기술 스택 |
|------|------|-----------|
| 프론트엔드 | 2명 | React |
| 백엔드 | 2명 | Node.js, TypeScript, Express, PostgreSQL |
| AI | 2명 | Python |
