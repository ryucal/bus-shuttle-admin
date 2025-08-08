// Supabase 설정
// 환경변수 또는 기본값 사용

const SUPABASE_CONFIG = {
    // 개발 환경
    development: {
        url: process.env.SUPABASE_URL || 'https://eafxirecbggrejokbdic.supabase.co',
        anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZnhpcmVjYmdncmVqb2tiZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODU3ODEsImV4cCI6MjA2OTE2MTc4MX0.qvgm2z-Sgo8nc_botxCzICepeMRtbAOva2byzPlMJWw'
    },
    
    // 프로덕션 환경
    production: {
        url: process.env.SUPABASE_URL || 'https://eafxirecbggrejokbdic.supabase.co',
        anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZnhpcmVjYmdncmVqb2tiZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODU3ODEsImV4cCI6MjA2OTE2MTc4MX0.qvgm2z-Sgo8nc_botxCzICepeMRtbAOva2byzPlMJWw'
    }
};

// 환경에 따른 설정 선택
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const config = isDevelopment ? SUPABASE_CONFIG.development : SUPABASE_CONFIG.production;

// 전역으로 설정 노출
window.SUPABASE_URL = config.url;
window.SUPABASE_ANON_KEY = config.anonKey;

// 설정 유효성 검사
if (!config.url || config.url === 'YOUR_SUPABASE_URL') {
    console.error('Supabase URL이 설정되지 않았습니다. config.js 파일을 확인하세요.');
}

if (!config.anonKey || config.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.error('Supabase Anon Key가 설정되지 않았습니다. config.js 파일을 확인하세요.');
}

// 설정 로드 완료 알림
console.log('Supabase 설정이 로드되었습니다.'); 