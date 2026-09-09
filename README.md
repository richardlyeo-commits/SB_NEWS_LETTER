# 삼영보영 주간 소식지

삼영·보영운수의 주간 소식지와 공지문을 언제 어디서나 확인할 수 있는 GitHub Pages 홈페이지입니다.

## 폴더 구조

```
홈페이지/                    ← GitHub Pages 배포 폴더
├── index.html              # 메인 페이지
├── newsletters.json          # 주간 소식지 데이터
├── notices.json            # 공지문 데이터
├── README.md               # 이 파일
└── 소식지/                  # 원본 PDF 파일
    ├── 20260105_소식지.pdf
    ├── 12대 중과실 금지 안내문.pdf
    └── ...
```

## GitHub Pages 배포 방법

### 1. GitHub 저장소 만들기
- GitHub에서 새 저장소를 만듭니다. (예: `SB_NEWS_LETTER`)
- 저장소를 Public으로 설정합니다.

### 2. 파일 업로드
- `홈페이지` 폴더 안의 **모든 파일과 폴더**를 GitHub 저장소에 업로드합니다.
- 또는 `홈페이지` 폴더 자체를 저장소 루트로 사용할 수도 있습니다.

**중요**: `index.html`, `newsletters.json`, `notices.json`뿐 아니라 `소식지` 폴더도 반드시 함께 업로드해야 합니다.

### 3. GitHub Pages 설정
1. 저장소 페이지에서 **Settings → Pages**로 이동
2. **Source**를 "Deploy from a branch"로 선택
3. **Branch**를 `main`, **folder**를 `/(root)`로 선택
4. Save 버튼 클릭
5. 잠시 후 `https://[사용자명].github.io/[저장소명]/` 주소에서 접속 가능

## 데이터 수정 방법

### 주간 소식지 추가 (`newsletters.json`)

```json
{
  "date": "2026-09-09",
  "title": "2026년 9월 9일자 주간 소식지",
  "summary": "이번 주 주요 내용을 간단히 요약해주세요.",
  "tags": ["안전", "신입", "노선"],
  "file_url": "소식지/20260909_소식지.pdf",
  "pages": 2
}
```

### 공지문 추가 (`notices.json`)

```json
{
  "date": "2026-09-09",
  "title": "안전 운행 공지문",
  "summary": "공지문 내용을 간단히 요약해주세요.",
  "tags": ["공지문", "안전"],
  "file_url": "소식지/20260909_공지문.pdf",
  "pages": 1
}
```

| 항목 | 설명 |
|------|------|
| date | 발행일 (YYYY-MM-DD 형식, 없으면 빈 문자열) |
| title | 제목 |
| summary | 내용 요약 (2~3줄) |
| tags | 키워드 태그 (검색에 사용) |
| file_url | 원본 파일 경로 (`소식지/파일명.pdf` 형식) |
| pages | 쪽 수 |

## 새 소식지/공지문 추가 절차

1. PDF 파일을 `홈페이지/소식지/` 폴더에 넣기
2. `newsletters.json` 또는 `notices.json`에 데이터 추가
3. GitHub에 Commit & Push
4. GitHub Pages에서 변경사항 반영될 때까지 잠시 대기

## 주의사항

- `date` 형식은 반드시 `YYYY-MM-DD`로 작성해주세요.
- `file_url`은 `index.html` 기준 상대 경로입니다. `소식지/파일명.pdf` 형식을 유지하세요.
- GitHub Pages에 반영되려면 파일을 Commit & Push해야 합니다.
- 캐시 때문에 변경 후 바로 반영되지 않을 수 있습니다. (`Ctrl + F5` 또는 시크릿 모드로 확인)
- **.hwpx(한글)** 또는 **.pptx** 파일은 웹에서 바로 열리지 않습니다. PDF로 변환 후 `소식지` 폴더에 넣고 JSON에 추가하세요.

## 문의

삼영·보영운수 월암영업소
