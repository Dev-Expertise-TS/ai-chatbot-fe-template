# Cloud Run 커스텀 도메인 및 HTTPS 설정 가이드

## 개요
이 문서는 Google Cloud Run 서비스에 커스텀 도메인(concierge.luxury-select.co.kr)과 HTTPS 인증서를 설정하는 과정에서 겪은 문제와 해결 방법을 기록합니다.

## 아키텍처 구성

### 필요한 GCP 리소스
1. **Cloud Run Service**: 애플리케이션 호스팅
2. **Global Load Balancer**: 고정 IP 제공 및 트래픽 라우팅
3. **Network Endpoint Group (NEG)**: Cloud Run과 Load Balancer 연결
4. **Backend Service**: 백엔드 설정 및 프로토콜 관리
5. **URL Maps**: 요청 라우팅 규칙
6. **Target Proxies**: HTTP/HTTPS 프록시
7. **Forwarding Rules**: 외부 트래픽 수신
8. **Global Static IP**: 고정 IP 주소
9. **SSL Certificate**: HTTPS 인증서

### 최종 아키텍처
```
사용자 → 도메인(A 레코드) → Load Balancer IP(34.111.251.8)
         ↓
HTTP(80)  → Forwarding Rule → HTTP Proxy → URL Map → Backend Service(HTTPS) → NEG → Cloud Run
         ↓
HTTPS(443) → Forwarding Rule → HTTPS Proxy → URL Map → Backend Service(HTTPS) → NEG → Cloud Run
```

## 주요 문제점과 해결 방법

### 1. SSL 인증서 프로비저닝 실패 (FAILED_NOT_VISIBLE)

**문제**: Google 관리형 SSL 인증서가 `FAILED_NOT_VISIBLE` 상태로 계속 실패

**원인 분석**:
- Google SSL 인증서는 도메인 소유권 검증을 위해 HTTP(80번 포트)로 접근
- Cloud Run은 HTTPS만 지원하고 HTTP는 지원하지 않음
- Backend Service가 HTTP 프로토콜로 설정되어 있어 Cloud Run과 통신 불가

**해결 방법**:
```hcl
# Backend Service를 HTTPS로 변경
resource "google_compute_backend_service" "default" {
  name                  = "select-ai-concierge-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"  # HTTP → HTTPS 변경 (중요!)
  
  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }
}
```

### 2. ERR_TOO_MANY_REDIRECTS 오류

**문제**: IP 주소(34.111.251.8)로 직접 접속 시 무한 리다이렉트 발생

**원인**: Cloud Run이 Host 헤더를 확인하지 못해 계속 리다이렉트

**해결**: Custom request headers 제거하여 Cloud Run이 자체적으로 처리하도록 함

### 3. HTTP 리다이렉트 설정

**문제**: HTTP → HTTPS 리다이렉트를 위한 URL Map 설정 시 503 오류

**원인**: Load Balancer의 URL 리다이렉트는 백엔드 서비스 없이는 작동하지 않음

**해결**: HTTP 트래픽도 Backend Service를 통해 라우팅
```hcl
# HTTP 백엔드 설정 (Cloud Run이 자체적으로 HTTPS로 리다이렉트)
resource "google_compute_url_map" "http_backend" {
  name            = "select-ai-concierge-http-backend"
  default_service = google_compute_backend_service.default.id
}
```

### 4. upstream connect error

**문제**: HTTPS 접속 시 "upstream connect error or disconnect/reset before headers"

**원인**: Backend Service의 custom request headers에 잘못된 형식 포함

**해결**: Custom headers 제거

## 중요한 교훈

### 1. Cloud Run의 특성
- **HTTPS 전용**: Cloud Run은 HTTP를 지원하지 않음
- **자동 리다이렉트**: HTTP 요청이 들어오면 자동으로 HTTPS로 307 리다이렉트
- **고정 IP 불가**: Cloud Run에 직접 고정 IP 할당 불가능, Load Balancer 필요

### 2. Load Balancer 설정
- **Backend Protocol**: Cloud Run과 통신할 때는 반드시 HTTPS 사용
- **HTTP 처리**: HTTP 트래픽도 Backend Service를 통해야 함
- **전파 시간**: 설정 변경 후 반영까지 30초~2분 소요

### 3. SSL 인증서
- **검증 방식**: Google 관리형 인증서는 HTTP를 통해 도메인 검증
- **프로비저닝 시간**: 정상적인 경우 15-30분, 문제가 있으면 `FAILED_NOT_VISIBLE`
- **대안**: DNS 검증 방식이나 수동 인증서 업로드 고려

## Terraform 구성 파일

전체 인프라는 `/workspace/terraform/main.tf`에 정의되어 있으며, 주요 구성:
- Global Static IP 생성
- NEG를 통한 Cloud Run 연결
- Backend Service (HTTPS 프로토콜)
- HTTP/HTTPS 포워딩 규칙
- Google 관리형 SSL 인증서

## 배포 절차

1. DNS A 레코드 설정: `concierge.luxury-select.co.kr → 34.111.251.8`
2. Terraform 배포: `terraform apply`
3. SSL 인증서 상태 확인: 
   ```bash
   gcloud compute ssl-certificates describe [CERT_NAME] --global
   ```
4. 인증서가 ACTIVE 상태가 될 때까지 대기 (15-60분)

## 트러블슈팅

- **503 Service Unavailable**: Backend Service 프로토콜 확인
- **SSL 프로비저닝 실패**: HTTP 백엔드가 정상 작동하는지 확인
- **Connection Reset**: Custom headers 제거 필요
- **무한 리다이렉트**: Host 헤더 처리 확인

## 참고사항

- Cloud Run의 기본 URL은 도메인 설정 후에도 계속 사용 가능
- CDN이 활성화되어 있어 정적 콘텐츠는 캐싱됨
- VPC connector를 통해 private 리소스 접근 가능