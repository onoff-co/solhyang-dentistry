# API 계약

모든 시간은 Asia/Seoul. POST에는 같은 출처의 `Origin`과 `Content-Type: application/json`이 필요합니다. 최대 본문 8KB, IP당 POST 100회/분. 요청 오류는 `{ "error": { "message": "...", "fields": { ... } } }` 형태입니다.

| 메서드·경로 | 동작 |
|---|---|
| GET `/api/health` | 서버 상태 |
| GET `/api/config` | 진료 항목, 운영 정보, 한국 날짜 |
| GET `/api/availability?date=YYYY-MM-DD&service=implant` | 실제 예약 기록을 반영한 시간 목록 |
| POST `/api/appointments` | 예약 생성, 201 + appointment·receipt |
| POST `/api/appointments/lookup` | 접수번호와 예약자 정보를 확인한 조회 |
| POST `/api/appointments/reschedule` | 기존 예약의 날짜·시간 변경 |
| POST `/api/appointments/cancel` | 예약 취소, 반복 요청에도 취소 상태 유지 |
| POST `/api/appointments/calendar` | 예약의 text/calendar 파일 |
| POST `/api/consultations` | 상담 접수, 201 + receipt |

예약 생성 입력: `name`, `phone`, `consent:true`, `service`, `date`, `time`, `requestId`(UUID). 같은 requestId와 같은 내용으로 다시 접수하면 같은 결과를 반환합니다. requestId를 다른 내용에 재사용하면 409를 반환합니다.

조회·취소·캘린더 입력: `name`, `phone`, `receipt`. 변경은 `date`, `time`도 필요합니다. 접수번호나 연락처가 다르면 존재 여부를 구분하지 않고 404를 반환합니다.

상담 입력: `name`, `phone`, `consent:true`, `service`, `requestId`. 증상·진료기록·결제 정보는 받지 않습니다.

검증 오류 422, 시간 충돌 409, 다른 출처 403, 과도한 요청 429, 지원하지 않는 메서드 405, 요청 크기 초과 413을 사용합니다. 데이터베이스·키·서버 소스는 정적 파일 제공 경로에 포함되지 않습니다.
