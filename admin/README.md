# 버스 셔틀 관리자 웹 페이지

Flutter + Supabase 기반 버스 셔틀 앱의 관리자 반응형 웹 페이지입니다.

## 주요 기능

### 1. 실시간 인원보고 피드
- 실시간으로 업데이트되는 인원보고 목록
- 체크박스로 단순 인원보고만 필터링 가능
- 단순 인원보고는 주황색으로 강조 표시

### 2. 인원보고 관리
- **삭제 기능**: 각 보고서의 삭제 버튼으로 즉시 삭제
- **수정 기능**: 수정 버튼으로 기사명, 방향, 출발지, 인원수 수정 가능

### 3. 대시보드 통계
- 총 출근/퇴근 인원수
- 총 운행 횟수
- 활성 기사 수
- 시간대별 인원 분포 차트

### 4. 반응형 디자인
- 데스크톱, 태블릿, 모바일 모든 기기 지원
- Tailwind CSS를 활용한 모던한 UI

## 설치 및 설정

### 1. Supabase 설정
`config.js` 파일에서 Supabase 프로젝트 정보를 설정하세요:

```javascript
const SUPABASE_CONFIG = {
    development: {
        url: 'https://your-project.supabase.co',
        anonKey: 'your-anon-key'
    },
    production: {
        url: 'https://your-project.supabase.co',
        anonKey: 'your-anon-key'
    }
};
```

### 2. 웹 서버 실행
로컬 개발 서버를 실행하려면:

```bash
# Python 3
python -m http.server 8000

# 또는 Node.js
npx serve .

# 또는 PHP
php -S localhost:8000
```

### 3. 브라우저에서 접속
```
http://localhost:8000/admin/
```

## 사용법

### 로그인
1. 관리자 계정의 이름과 전화번호로 로그인
2. 관리자 권한이 있는 계정만 접근 가능
3. 앱과 동일한 로그인 방식 사용

### 대시보드 사용
1. **날짜 선택**: 원하는 날짜의 데이터 조회
2. **새로고침**: 최신 데이터로 업데이트
3. **단순보고 필터**: 체크박스로 단순 인원보고만 표시

### 인원보고 관리
1. **수정**: 수정 버튼(연필 아이콘) 클릭
2. **삭제**: 삭제 버튼(휴지통 아이콘) 클릭
3. **확인**: 작업 완료 후 자동으로 목록 업데이트

## 데이터베이스 스키마

관리자 웹 페이지는 다음 Supabase 테이블을 사용합니다:

### users 테이블
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  car_number TEXT,
  role TEXT CHECK (role IN ('driver', 'admin')) DEFAULT 'driver',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### shuttle_reports 테이블
```sql
CREATE TABLE shuttle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES users(id),
  driver_name TEXT NOT NULL,
  car_number TEXT,
  shuttle_type TEXT CHECK (shuttle_type IN ('근로자 셔틀', '직원 셔틀', '출근', '퇴근')),
  direction TEXT CHECK (direction IN ('출근', '퇴근')),
  departure TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  passenger_count INTEGER NOT NULL CHECK (passenger_count >= 0 AND passenger_count <= 45),
  exclude_from_matching BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 보안

- Row Level Security (RLS) 정책 적용
- 관리자 권한 검증
- 인증된 사용자만 데이터 접근 가능

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Tailwind CSS
- **Charts**: Chart.js
- **Icons**: Font Awesome
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Authentication**: Supabase Auth

## 브라우저 지원

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 개발자 정보

이 관리자 웹 페이지는 Flutter 앱과 동일한 Supabase 데이터베이스를 공유하여 실시간으로 데이터를 동기화합니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 