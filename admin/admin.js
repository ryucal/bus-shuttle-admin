// Supabase 설정
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

        // Supabase 클라이언트 초기화 (실시간 기능 제거)
let supabase;
try {
    console.log('Supabase 설정 확인:');
    console.log('URL:', SUPABASE_URL);
    console.log('Anon Key:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'undefined');
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        global: {
            headers: {
                'X-Client-Info': 'bus-shuttle-admin-web'
            }
        }
    });
    
    console.log('✅ Supabase 클라이언트 초기화 성공');
} catch (error) {
    console.error('❌ Supabase 클라이언트 초기화 실패:', error);
}

// 전역 변수
let currentUser = null;
let reports = []; // 선택된 날짜의 데이터
let allReports = []; // 전체 데이터 (기간별 통계용)
let timeDistributionChart = null;
let selectedDate = getTodayDate(); // 오늘 날짜로 동적 설정
let selectedDriverFilter = 'all'; // 선택된 기사 필터

let drivers = []; // 기사 목록

// 매칭 타입 및 색상 정의
const MATCHING_TYPES = {
    NORMAL: 'normal',      // 일반적인 순차 매칭
    LATE_COMPLETION: 'late' // 나중에 완성된 매칭
};

const MATCHING_COLORS = {
    normal: [
        { text: 'text-green-600', bg: 'bg-green-50' },    // 1번째 일반 매칭
        { text: 'text-orange-600', bg: 'bg-orange-50' },  // 2번째 일반 매칭
        { text: 'text-green-600', bg: 'bg-green-50' },    // 3번째 일반 매칭
        { text: 'text-orange-600', bg: 'bg-orange-50' },  // 4번째 일반 매칭
        { text: 'text-green-600', bg: 'bg-green-50' },    // 5번째 일반 매칭
        { text: 'text-orange-600', bg: 'bg-orange-50' }   // 6번째 일반 매칭
    ],
    late: { text: 'text-purple-600', bg: 'bg-purple-50' } // 나중에 완성된 매칭
};

// 오늘 날짜를 한국 시간대로 가져오는 함수
function getTodayDate() {
    const now = new Date();
    // 한국 시간대로 날짜 포맷팅
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    
    return `${year}-${month}-${day}`;
}

// 로그인 상태 확인 및 복원
async function checkAndRestoreLoginState() {
    try {
        // localStorage에서 로그인 상태 확인
        const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        const savedUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
        const expiresAt = localStorage.getItem('adminExpiresAt');
        
        console.log('로그인 상태 확인:', { isLoggedIn, savedUser: !!savedUser, expiresAt });
        
        // 세션 만료 확인 (24시간)
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
            console.log('세션이 만료되었습니다. 로그아웃 처리.');
            handleLogout();
            return;
        }
        
        // 로그인 상태가 있고 사용자 정보가 있으면 복원
        if (isLoggedIn && savedUser) {
            console.log('저장된 로그인 상태 복원:', savedUser.name);
            currentUser = savedUser;
            
            // 오늘 날짜로 설정 (한국 시간대 기준)
            const today = getTodayDate();
            selectedDate = today;
            
            // 여러 방법으로 날짜 설정
            if (selectedDateInput) {
                selectedDateInput.value = today;
                selectedDateInput.setAttribute('value', today);
                selectedDateInput.defaultValue = today;
                
                // 강제로 이벤트 발생
                selectedDateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // 현재 날짜 표시 업데이트
            if (currentDateDisplay) {
                currentDateDisplay.textContent = `현재 날짜: ${getCurrentDateDisplay()}`;
            }
            
            // 기사별 통계 날짜 선택 필드 초기화
            const driverStatsDateInput = document.getElementById('driverStatsDate');
            if (driverStatsDateInput) {
                driverStatsDateInput.value = '';
            }
            
            // 기간 표시 업데이트
            updatePeriodDisplay();
            
            // 관리자 화면 표시
            showAdminScreen();
            
            // 데이터 로드
            console.log('저장된 로그인 상태로 데이터 로드 시작...');
            await loadDashboardData();
            
            showNotification(`${savedUser.name} 관리자님, 환영합니다!`, 'success');
        } else {
            console.log('저장된 로그인 상태가 없습니다. 로그인 화면 표시.');
            showLoginScreen();
        }
    } catch (error) {
        console.error('로그인 상태 복원 오류:', error);
        showLoginScreen();
    }
}

// 현재 날짜를 한국어로 표시하는 함수
function getCurrentDateDisplay() {
    const now = new Date();
    return now.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
}

// DOM 요소들
const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const adminScreen = document.getElementById('adminScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const selectedDateInput = document.getElementById('selectedDate');
// refreshBtn 제거됨

const reportsList = document.getElementById('reportsList');
const reportCount = document.getElementById('reportCount');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const cancelEdit = document.getElementById('cancelEdit');
const addModal = document.getElementById('addModal');
const addForm = document.getElementById('addForm');
const cancelAdd = document.getElementById('cancelAdd');
const addReportBtn = document.getElementById('addReportBtn');
const currentDateDisplay = document.getElementById('currentDateDisplay');
const periodDisplay = document.getElementById('periodDisplay');

// 통계 카드 요소들
const totalCommute = document.getElementById('totalCommute');
const totalOffWork = document.getElementById('totalOffWork');
const activeDrivers = document.getElementById('activeDrivers');

// 기사 필터 드롭다운
const driverFilterSelect = document.getElementById('driverFilterSelect');

// 탭 요소들
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// 헬퍼 함수들
function parseDepartureTime(departureTime) {
    try {
        console.log('parseDepartureTime 입력:', departureTime);
        
        const parts = departureTime.split(' ');
        const dateParts = parts[0].split('.');
        const timeParts = parts[1].split(':');
        
        console.log('파싱된 부분들:', { dateParts, timeParts });
        
        let year, month, day;
        if (dateParts.length === 3) {
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1; // 0-based
            day = parseInt(dateParts[2]);
        } else if (dateParts.length === 2) {
            year = new Date().getFullYear();
            month = parseInt(dateParts[0]) - 1;
            day = parseInt(dateParts[1]);
        } else {
            throw new Error('날짜 형식 오류');
        }
        
        const result = new Date(year, month, day, 
            parseInt(timeParts[0]), 
            parseInt(timeParts[1])
        );
        
        console.log('parseDepartureTime 결과:', result.toISOString());
        console.log('파싱된 날짜:', result.toDateString());
        return result;
    } catch (e) {
        console.error('departure_time 파싱 오류:', e, 'departureTime:', departureTime);
        return new Date();
    }
}

function isSameDate(date1, date2) {
    const result = date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
    
    console.log('isSameDate 비교:', {
        date1: date1.toDateString(),
        date2: date2.toDateString(),
        year1: date1.getFullYear(),
        year2: date2.getFullYear(),
        month1: date1.getMonth(),
        month2: date2.getMonth(),
        day1: date1.getDate(),
        day2: date2.getDate(),
        result: result
    });
    
    return result;
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 관리자 페이지 초기화 시작...');
    
    // 로딩 화면 강제 숨김 타임아웃 설정 (10초 후)
    const loadingTimeout = setTimeout(() => {
        console.log('⚠️ 로딩 타임아웃 - 강제로 로딩 화면을 숨깁니다');
        hideLoadingScreen();
        showLoginScreen();
    }, 10000);
    
    try {
        // 페이지 로드 시 즉시 오늘 날짜로 설정 (한국 시간대 기준)
        const today = getTodayDate();
        selectedDate = today;
        
        console.log('페이지 로드 - 오늘 날짜 설정:', today);
        console.log('selectedDate 초기값:', selectedDate);
        console.log('현재 시간 (한국):', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
        console.log('현재 시간 (UTC):', new Date().toISOString());
        
        // 캐시 무효화를 위한 강제 새로고침 체크
        if (performance.navigation.type === 1) {
            console.log('페이지가 새로고침되었습니다.');
        }
        
        // DOM 요소가 로드된 후 날짜 입력 필드 설정
        setTimeout(() => {
            if (selectedDateInput) {
                selectedDateInput.value = today;
                selectedDateInput.setAttribute('value', today);
                console.log('DOM 로드 후 selectedDateInput 설정:', selectedDateInput.value);
            }
        }, 100);
        
        await initializeApp();
        clearTimeout(loadingTimeout); // 성공시 타임아웃 해제
        
        // 피크타임 모달 이벤트 리스너 등록
        setupPeakTimeModalEvents();
        
    } catch (error) {
        console.error('❌ 초기화 중 오류 발생:', error);
        clearTimeout(loadingTimeout);
        hideLoadingScreen();
        showLoginScreen();
    }
});

async function initializeApp() {
    console.log('📱 initializeApp 함수 시작...');
    
    try {
        // Supabase 클라이언트 확인
        console.log('🔧 Supabase 클라이언트 확인 중...');
        if (!supabase) {
            console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
            throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
        }
        console.log('✅ Supabase 클라이언트 확인 완료');

        // 현재 시간 표시
        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);

        // 날짜 선택기를 오늘 날짜로 초기화 (한국 시간대 기준)
        const today = getTodayDate();
        selectedDate = today;
        
        console.log('오늘 날짜 설정:', today);
        console.log('selectedDate 설정:', selectedDate);
        
        // 여러 방법으로 날짜 설정
        if (selectedDateInput) {
            selectedDateInput.value = today;
            selectedDateInput.setAttribute('value', today);
            selectedDateInput.defaultValue = today;
            
            console.log('selectedDateInput.value 설정:', selectedDateInput.value);
            console.log('selectedDateInput.getAttribute("value"):', selectedDateInput.getAttribute('value'));
            
            // 강제로 이벤트 발생
            selectedDateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // 현재 날짜 표시 업데이트
        if (currentDateDisplay) {
            currentDateDisplay.textContent = `현재 날짜: ${getCurrentDateDisplay()}`;
        }
        
        // 기간 표시 업데이트
        updatePeriodDisplay();
        
        console.log('앱 초기화 - 오늘 날짜 설정:', today);
        console.log('selectedDate:', selectedDate);
        console.log('selectedDateInput.value:', selectedDateInput.value);
        console.log('selectedDateInput.getAttribute("value"):', selectedDateInput.getAttribute('value'));

        // 이벤트 리스너 등록
        setupEventListeners();

        // 실시간 상태 초기화
        // 실시간 상태 업데이트 제거됨

        // 로그인 상태 확인 및 복원
        await checkAndRestoreLoginState();
        
    } catch (error) {
        console.error('앱 초기화 오류:', error);
        showLoginScreen();
    } finally {
        hideLoadingScreen();
    }
}

function setupEventListeners() {
    // 로그인 폼
    loginForm.addEventListener('submit', handleLogin);

    // 로그아웃
    logoutBtn.addEventListener('click', handleLogout);

    // 날짜 변경
    selectedDateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        console.log('날짜 변경됨:', selectedDate);
        console.log('날짜 변경됨 - 타입:', typeof selectedDate);
        console.log('날짜 변경됨 - selectedDateInput.value:', selectedDateInput.value);
        loadDashboardData();
    });

    // 새로고침 기능은 testRealtimeBtn으로 통합됨
    
    // 데이터 새로고침 버튼
    document.getElementById('testRealtimeBtn').addEventListener('click', testRealtimeConnection);

    // 미완성 운행 알림 버튼
    document.getElementById('incompleteOperationsBtn').addEventListener('click', showIncompleteOperationsModal);
    document.getElementById('closeIncompleteModal').addEventListener('click', hideIncompleteOperationsModal);
    document.getElementById('closeIncompleteModalBtn').addEventListener('click', hideIncompleteOperationsModal);
    
    // 소속별 상세 정보 모달 닫기 버튼
    document.getElementById('closeAffiliationModal')?.addEventListener('click', hideAffiliationDetailModal);
    document.getElementById('closeAffiliationModalBtn')?.addEventListener('click', hideAffiliationDetailModal);

    // 단순 인원보고 필터


    // 통합 대시보드 이벤트
    document.getElementById('periodSelect').addEventListener('change', function() {
        // 기간 선택 시 날짜 선택 초기화
        document.getElementById('driverStatsDate').value = '';
        loadStatisticsData();
        updatePeriodDisplay();
    });
    
    // 기사별 통계 날짜 선택 이벤트
    document.getElementById('driverStatsDate').addEventListener('change', function() {
        // 날짜 선택 시 기간 선택 초기화
        document.getElementById('periodSelect').value = 'today';
        updateDriverStatisticsForDate(this.value);
    });
    
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    
    // 기사 필터 이벤트
    driverFilterSelect.addEventListener('change', function() {
        selectedDriverFilter = this.value;
        const driverStatsDate = document.getElementById('driverStatsDate').value;
        if (driverStatsDate) {
            updateDriverStatisticsForDate(driverStatsDate);
        } else {
            updateDriverStatistics(document.getElementById('periodSelect').value);
        }
    });

    // 수정 모달
    cancelEdit.addEventListener('click', hideEditModal);
    editForm.addEventListener('submit', handleEditSubmit);
    
    // 추가 모달
    addReportBtn.addEventListener('click', showAddModal);
    cancelAdd.addEventListener('click', hideAddModal);
    addForm.addEventListener('submit', handleAddSubmit);
    
    // 소속별 관리 버튼들
    document.getElementById('addAffiliationBtn')?.addEventListener('click', showAddAffiliationModal);
    document.getElementById('exportAffiliationBtn')?.addEventListener('click', exportAffiliationReport);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();

    // 입력값 검증
    if (!name || !phone) {
        showNotification('이름과 전화번호를 모두 입력해주세요.', 'error');
        return;
    }

    try {
        showLoadingScreen();
        
        // Supabase 클라이언트 확인
        if (!supabase) {
            throw new Error('Supabase 연결에 실패했습니다.');
        }
        
        // 전화번호로 사용자 찾기
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .eq('role', 'admin')
            .single();

        if (userError) {
            console.error('사용자 조회 오류:', userError);
            throw new Error('사용자 조회 중 오류가 발생했습니다.');
        }

        if (!user) {
            throw new Error('관리자 계정을 찾을 수 없습니다.');
        }

        // 이름 확인 (필수)
        if (user.name !== name) {
            throw new Error('이름이 등록된 정보와 일치하지 않습니다.');
        }

        // 로그인 성공
        currentUser = user;
        
        // localStorage에 로그인 상태 저장 (24시간 유지)
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24시간
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminUser', JSON.stringify(user));
        localStorage.setItem('adminExpiresAt', expiresAt.toString());
        
        console.log('로그인 상태를 localStorage에 저장:', {
            adminLoggedIn: 'true',
            adminUser: user.name,
            expiresAt: new Date(expiresAt).toLocaleString()
        });
        
        // 오늘 날짜로 설정 (한국 시간대 기준)
        const today = getTodayDate();
        selectedDate = today;
        
        // 여러 방법으로 날짜 설정
        if (selectedDateInput) {
            selectedDateInput.value = today;
            selectedDateInput.setAttribute('value', today);
            selectedDateInput.defaultValue = today;
            
            // 강제로 이벤트 발생
            selectedDateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // 현재 날짜 표시 업데이트
        if (currentDateDisplay) {
            currentDateDisplay.textContent = `현재 날짜: ${getCurrentDateDisplay()}`;
        }
        
        // 기사별 통계 날짜 선택 필드 초기화
        const driverStatsDateInput = document.getElementById('driverStatsDate');
        if (driverStatsDateInput) {
            driverStatsDateInput.value = '';
        }
        
        // 기간 표시 업데이트
        updatePeriodDisplay();
        
        console.log('로그인 성공 - 설정된 날짜:', selectedDate);
        console.log('오늘 날짜:', today);
        console.log('날짜 선택기 값:', selectedDateInput.value);
        console.log('selectedDateInput.getAttribute("value"):', selectedDateInput.getAttribute('value'));
        
        showAdminScreen();
        
        // 즉시 데이터 로드
        console.log('로그인 후 데이터 로드 시작...');
        await loadDashboardData();
        
        // 실시간 구독 제거 - 새로고침 버튼으로만 데이터 업데이트
        console.log('실시간 구독 비활성화 - 새로고침 버튼 사용');
        
        showNotification(`${user.name} 관리자님, 환영합니다! 오늘(${selectedDate}) 데이터를 불러왔습니다.`, 'success');
        
    } catch (error) {
        console.error('로그인 오류:', error);
        showNotification('로그인에 실패했습니다: ' + error.message, 'error');
    } finally {
        hideLoadingScreen();
    }
}

async function handleLogout() {
    try {
        // localStorage에서 로그인 상태 제거
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminExpiresAt');
        
        console.log('localStorage에서 로그인 상태 제거 완료');
        
        // 로그아웃 처리
        currentUser = null;
        
        // 로그인 화면으로 이동
        showLoginScreen();
        
        showNotification('로그아웃되었습니다.', 'info');
        
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

async function loadDashboardData() {
    try {
        showLoadingScreen();
        
        console.log('=== loadDashboardData 시작 ===');
        console.log('선택된 날짜:', selectedDate);
        console.log('선택된 날짜 타입:', typeof selectedDate);
        console.log('현재 시간 (한국):', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
        console.log('현재 시간 (UTC):', new Date().toISOString());
        console.log('오늘 날짜 (비교용):', getTodayDate());
        console.log('날짜 일치 여부:', selectedDate === getTodayDate());
        
        // 전체 데이터를 가져와서 저장 (기간별 통계용)
        const { data: allData, error: allError } = await supabase
            .from('shuttle_reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (allError) throw allError;

        console.log('전체 데이터 수:', allData?.length || 0);
        allReports = allData || [];
        
        // 선택된 날짜의 데이터만 필터링 (데이터베이스가 이미 한국 시간으로 저장됨)
        console.log('필터링 시작 - 선택된 날짜:', selectedDate);
        console.log('필터링 시작 - selectedDate 타입:', typeof selectedDate);
        
        const filteredData = allReports.filter(report => {
            // 데이터베이스에 이미 한국 시간이 저장되어 있으므로 변환 불필요
            const reportDate = new Date(report.created_at);
            
            // 선택된 날짜를 Date 객체로 변환
            const targetDate = new Date(selectedDate + 'T00:00:00');
            
            const isSame = isSameDate(reportDate, targetDate);
            
            console.log(`보고서: ${report.driver_name} - ${report.created_at} -> 원본시간: ${reportDate.toISOString()} -> 타겟날짜: ${targetDate.toDateString()} -> 같은날: ${isSame}`);
            
            return isSame;
        });
        
        console.log('필터링된 데이터 수:', filteredData.length);
        
        // created_at 기준으로 정렬 (앱과 동일한 방식)
        filteredData.sort((a, b) => {
            const timeA = new Date(a.created_at);
            const timeB = new Date(b.created_at);
            return timeB - timeA; // 최신순
        });
        
        reports = filteredData;
        
        if (reports.length > 0) {
            console.log('첫 번째 보고:', reports[0]);
        }
        
        // 통계 업데이트
        updateStatistics();
        
        // 차트 업데이트
        updateTimeDistributionChart();
        
        // 보고서 목록 업데이트
        updateReportsList();
        
        // 기사별 운행 통계만 기간 선택 적용 (기본값: 오늘)
        updateDriverStatistics('today');
        
        // 기사 데이터 로드
        await loadDriversData();
        
        // 다른 통계들은 기간 선택 없이 오늘 날짜 기준으로 유지
        updateDepartureChart();
        updateDepartureStatusTable();
        
        // 소속별 데이터 업데이트
        updateAffiliationData();
        
        // 미완성 운행 체크 (전일 기준)
        await checkIncompleteOperations();
        
        console.log('대시보드 로드 완료 - 전체 데이터:', allReports.length, '선택된 날짜 데이터:', reports.length);
        
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        showNotification('데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
        hideLoadingScreen();
    }
}

function updateStatistics() {
    const stats = calculateStatistics();
    
    totalCommute.textContent = `${stats.totalCommute}명`;
    totalOffWork.textContent = `${stats.totalOffWork}명`;

    activeDrivers.textContent = `${stats.activeDrivers}명`;
}

function calculateStatistics() {
    let totalCommuteCount = 0;
    let totalOffWorkCount = 0;
    let activeDriversSet = new Set();

    reports.forEach(report => {
        if (report.direction === '출근') {
            totalCommuteCount += report.passenger_count;
        } else if (report.direction === '퇴근') {
            totalOffWorkCount += report.passenger_count;
        }
        
        if (report.driver_name) {
            activeDriversSet.add(report.driver_name);
        }
    });

    return {
        totalCommute: totalCommuteCount,
        totalOffWork: totalOffWorkCount,
        activeDrivers: activeDriversSet.size
    };
}

function updateTimeDistributionChart() {
    const timeData = calculateTimeDistribution();
    
    const ctx = document.getElementById('timeDistributionChart').getContext('2d');
    
    if (timeDistributionChart) {
        timeDistributionChart.destroy();
    }

    timeDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: timeData.labels,
            datasets: [
                {
                    label: '출근',
                    data: timeData.commute,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                },
                {
                    label: '퇴근',
                    data: timeData.offWork,
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '인원수'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '시간대'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
    
    // 피크 타임 순위 업데이트 (비동기 처리)
    setTimeout(() => {
        calculateAndDisplayPeakTimes().catch(error => {
            console.error('피크 타임 업데이트 실패:', error);
        });
    }, 100);
}

function calculateTimeDistribution() {
    const timeSlots = {};
    
    // 시간대별 데이터 초기화
    for (let hour = 0; hour < 24; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        timeSlots[timeSlot] = { commute: 0, offWork: 0 };
    }

    // 보고서 데이터로 시간대별 통계 계산
    reports.forEach(report => {
        const reportTime = new Date(report.created_at);
        const hour = reportTime.getHours();
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        
        if (report.direction === '출근') {
            timeSlots[timeSlot].commute += report.passenger_count;
        } else if (report.direction === '퇴근') {
            timeSlots[timeSlot].offWork += report.passenger_count;
        }
    });

    return {
        labels: Object.keys(timeSlots),
        commute: Object.values(timeSlots).map(slot => slot.commute),
        offWork: Object.values(timeSlots).map(slot => slot.offWork)
    };
}

function updateReportsList() {
    const filteredReports = filterReports();
    reportCount.textContent = `${filteredReports.length}개의 보고`;
    
    reportsList.innerHTML = '';
    
    if (filteredReports.length === 0) {
        reportsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>선택된 날짜에 인원보고가 없습니다.</p>
            </div>
        `;
        return;
    }

    filteredReports.forEach(report => {
        const reportElement = createReportElement(report);
        reportsList.appendChild(reportElement);
    });
}

function filterReports() {
    // 모든 보고를 반환 (필터링 없음)
    return reports;
}

function filterReportsByPeriod(reports, period) {
    const selectedDate = new Date(selectedDateInput.value);
    let startDate, endDate;
    
    switch (period) {
        case 'today':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = selectedDate.getDay();
            const monday = new Date(selectedDate);
            monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
            endDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'lastMonth':
            // 전월 시작일과 종료일 계산
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            
            let previousMonth, previousYear;
            if (currentMonth === 0) { // 1월인 경우
                previousMonth = 11; // 12월
                previousYear = currentYear - 1;
            } else {
                previousMonth = currentMonth - 1;
                previousYear = currentYear;
            }
            
            startDate = new Date(previousYear, previousMonth, 1);
            endDate = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
            break;
        default:
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    }
    
    console.log(`기간별 필터링: ${period}`, { 
        startDate, 
        endDate,
        startDateLocal: startDate.toLocaleDateString('ko-KR'),
        endDateLocal: endDate.toLocaleDateString('ko-KR')
    });
    
    return reports.filter(report => {
        // 데이터베이스에 이미 한국 시간이 저장되어 있으므로 변환 불필요
        const reportDate = new Date(report.created_at);
        
        const isInRange = reportDate >= startDate && reportDate <= endDate;
        if (isInRange) {
            console.log(`포함된 보고: ${report.driver_name} - ${report.created_at} (원본시간: ${reportDate.toISOString()})`);
        }
        
        return isInRange;
    });
}

// 앱의 OperationMatchingUtils와 동일한 로직으로 완성된 운행 쌍들을 찾습니다
function findCompletedOperations(reports, targetDate) {
    console.log('=== 매칭 디버그 ===');
    console.log('전체 보고서 수:', reports.length);
    console.log('타겟 날짜:', targetDate.toISOString().split('T')[0]);
    
    // 날짜별로 필터링 (데이터베이스가 이미 한국 시간으로 저장됨)
    const dateReports = reports.filter(report => {
        // 데이터베이스에 이미 한국 시간이 저장되어 있으므로 변환 불필요
        const reportDate = new Date(report.created_at);
        
        const isSame = isSameDate(reportDate, targetDate);
        console.log(`보고서: ${report.shuttle_type} / ${report.direction} / ${report.created_at} -> 원본시간: ${reportDate.toISOString()} -> 같은날: ${isSame}`);
        return isSame;
    });
    
    console.log('날짜 필터링 후 보고서 수:', dateReports.length);
    
    // 셔틀 타입별로 그룹화
    const groupedByType = {};
    for (const report of dateReports) {
        console.log(`처리 중: ${report.shuttle_type} / ${report.direction} / excludeFromMatching: ${report.exclude_from_matching}`);
        
        if (report.shuttle_type === '근로자 셔틀' || report.shuttle_type === '직원 셔틀') {
            // exclude_from_matching이 true인 보고서는 제외
            if (!report.exclude_from_matching) {
                if (!groupedByType[report.shuttle_type]) {
                    groupedByType[report.shuttle_type] = [];
                }
                groupedByType[report.shuttle_type].push(report);
                console.log('그룹에 추가됨:', report.shuttle_type);
            } else {
                console.log('매칭에서 제외됨:', report.shuttle_type, '(exclude_from_matching: true)');
            }
        } else {
            console.log('그룹에서 제외됨:', report.shuttle_type);
        }
    }
    
    // 각 셔틀 타입별로 출근/퇴근 쌍 매칭
    const completedPairs = [];
    
    for (const [shuttleType, typeReports] of Object.entries(groupedByType)) {
        console.log('매칭 시작:', shuttleType, `(${typeReports.length}개 보고서)`);
        const pairs = matchCommuteOffWorkPairs(typeReports, shuttleType, targetDate);
        console.log('매칭 결과:', pairs.length, '개 쌍');
        completedPairs.push(...pairs);
    }
    
    // 완성 시간순으로 정렬
    completedPairs.sort((a, b) => a.completionTime - b.completionTime);
    
    console.log('매칭 결과:', {
        totalPairs: completedPairs.length,
        pairs: completedPairs.map(p => ({
            driver: p.commuteReport.driver_name,
            commuteTime: p.commuteReport.created_at,
            offWorkTime: p.offWorkReport.created_at,
            shuttleType: p.shuttleType
        }))
    });
    
    return completedPairs;
}

// 매칭 타입을 판단하는 함수
function determineMatchingType(commuteReport, offWorkReport, allReports, targetDate) {
    // 출근 보고서와 퇴근 보고서 사이에 다른 출근 보고서가 있는지 확인
    const commuteTime = new Date(commuteReport.created_at);
    const offWorkTime = new Date(offWorkReport.created_at);
    
    // 같은 날짜의 다른 출근 보고서들 확인
    const otherCommuteReports = allReports.filter(report => {
        const reportTime = new Date(report.created_at);
        return isSameDate(reportTime, targetDate) &&
               report.direction === '출근' &&
               report.id !== commuteReport.id &&
               reportTime > commuteTime &&
               reportTime < offWorkTime &&
               !report.exclude_from_matching; // 매칭에서 제외된 보고서는 무시
    });
    
    // 중간에 다른 출근 보고서가 있으면 '나중에 완성'
    return otherCommuteReports.length > 0 ? MATCHING_TYPES.LATE_COMPLETION : MATCHING_TYPES.NORMAL;
}

// 출근/퇴근 쌍을 매칭합니다
function matchCommuteOffWorkPairs(reports, shuttleType, targetDate) {
    const pairs = [];
    
    console.log('매칭 함수 시작:', shuttleType);
    console.log('전체 보고서:', reports.map(r => `${r.direction}(${r.created_at})`).join(', '));
    
    // excludeFromMatching이 true인 보고서는 제외
    const filteredReports = reports.filter(r => !r.exclude_from_matching);
    console.log('excludeFromMatching 필터링 후:', filteredReports.length, '개 (제외됨:', reports.length - filteredReports.length, '개)');
    
    // 시간순으로 정렬
    filteredReports.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    console.log('정렬된 보고서:', filteredReports.map(r => `${r.direction}(${r.created_at})`).join(', '));
    
    // 순차적 교대 매칭
    let waitingDirection = null; // 대기 중인 방향 (출근 또는 퇴근)
    let waitingReport = null; // 대기 중인 보고서
    
    for (const report of filteredReports) {
        console.log('처리 중:', report.direction + '(' + report.created_at + ')');
        
        if (waitingDirection === null) {
            // 첫 번째 보고서 또는 이전 매칭 완료 후
            waitingDirection = report.direction;
            waitingReport = report;
            console.log('대기 시작:', report.direction + '(' + report.created_at + ')');
        } else if (report.direction !== waitingDirection) {
            // 다른 방향의 보고서가 들어옴 → 매칭 성공!
            if (waitingReport !== null) {
                const firstReport = waitingDirection === '출근' ? waitingReport : report;
                const secondReport = waitingDirection === '출근' ? report : waitingReport;
                
                pairs.push({
                    commuteReport: firstReport,
                    offWorkReport: secondReport,
                    shuttleType: shuttleType,
                    operationDate: targetDate,
                    completionTime: new Date(secondReport.created_at)
                });
                
                console.log('매칭 성공:', firstReport.direction + '(' + firstReport.created_at + ') ↔ ' + secondReport.direction + '(' + secondReport.created_at + ')');
            }
            
            // 매칭 완료 후 대기 상태 초기화
            waitingDirection = null;
            waitingReport = null;
        } else {
            // 같은 방향의 보고서가 또 들어옴 → 이전 대기 보고서는 버리고 새로운 보고서로 교체
            console.log('같은 방향 보고서 교체:', waitingReport.direction + '(' + waitingReport.created_at + ') → ' + report.direction + '(' + report.created_at + ')');
            waitingReport = report;
        }
    }
    
    return pairs;
}

// 출발지별 배경색 매핑 (Flutter 앱과 동일)
function getDepartureBackgroundColor(departure) {
    switch (departure) {
        // 근로자 셔틀 출발지 (파란색 계열과 초록색 계열)
        case '독성리':
            return '#E3F2FD'; // blue.shade50
        case '가좌리':
            return '#E8F5E8'; // green.shade50
        case '원삼면사무소':
            return '#E8EAF6'; // indigo.shade50
        case '서측공동구':
            return '#E0F2F1'; // teal.shade50
        case '전진식당':
            return '#E0F7FA'; // cyan.shade50
        case '양지(외부)':
            return '#E1F5FE'; // lightBlue.shade50
        case '백암(외부)':
            return '#F1F8E9'; // lightGreen.shade50
        case '천리(외부)':
            return '#ECEFF1'; // blueGrey.shade50
        case '원삼건강검진':
            return '#EDE7F6'; // deepPurple.shade50

        // 직원 셔틀 출발지 (따뜻한 색상 계열)
        case '원삼':
            return '#FFF3E0'; // orange.shade50
        case '안성':
            return '#FCE4EC'; // pink.shade50
        case '용인':
            return '#F3E5F5'; // purple.shade50
        case '죽능리':
            return '#FFF8E1'; // amber.shade50
        case '덕성리':
            return '#EFEBE9'; // brown.shade50
        case '백암박곡리':
            return '#FBE9E7'; // deepOrange.shade50
        case '경남아너스빌':
            return '#FFEBEE'; // red.shade50

        // 기본값 (흰색)
        default:
            return '#FFFFFF';
    }
}

// 출발지별 테두리 색상 매핑 (Flutter 앱과 동일)
function getDepartureBorderColor(departure) {
    switch (departure) {
        // 근로자 셔틀 출발지
        case '독성리':
            return '#90CAF9'; // blue.shade200
        case '가좌리':
            return '#A5D6A7'; // green.shade200
        case '원삼면사무소':
            return '#9FA8DA'; // indigo.shade200
        case '서측공동구':
            return '#80CBC4'; // teal.shade200
        case '전진식당':
            return '#80DEEA'; // cyan.shade200
        case '양지(외부)':
            return '#81D4FA'; // lightBlue.shade200
        case '백암(외부)':
            return '#C5E1A5'; // lightGreen.shade200
        case '천리(외부)':
            return '#B0BEC5'; // blueGrey.shade200
        case '원삼건강검진':
            return '#B39DDB'; // deepPurple.shade200

        // 직원 셔틀 출발지
        case '원삼':
            return '#FFCC80'; // orange.shade200
        case '안성':
            return '#F8BBD9'; // pink.shade200
        case '용인':
            return '#CE93D8'; // purple.shade200
        case '죽능리':
            return '#FFF176'; // amber.shade200
        case '덕성리':
            return '#BCAAA4'; // brown.shade200
        case '백암박곡리':
            return '#FFAB91'; // deepOrange.shade200
        case '경남아너스빌':
            return '#EF9A9A'; // red.shade200

        // 기본값
        default:
            return '#E0E0E0'; // grey.shade300
    }
}

// 출발지별 텍스트 색상 (가독성 확보)
function getDepartureTextColor(departure) {
    // 모든 배경색이 연한 색상(shade50)이므로 어두운 텍스트 사용
    return '#212121'; // 진한 회색
}

function createReportElement(report) {
    // 시간 파싱 - departure_time이 있으면 그것을 사용, 없으면 created_at 사용
    let reportTime;
    let timeString;
    
    if (report.departure_time && report.departure_time.trim() !== '') {
        // departure_time 형식: "2025.07.28 14:30" 또는 "07.28 14:30"
        try {
            const parts = report.departure_time.split(' ');
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            
            // 연도가 포함된 경우와 포함되지 않은 경우 처리
            let year, month, day;
            if (dateParts.length === 3) {
                // "2025.07.28" 형식
                year = parseInt(dateParts[0]);
                month = parseInt(dateParts[1]) - 1; // 0-based
                day = parseInt(dateParts[2]);
            } else if (dateParts.length === 2) {
                // "07.28" 형식 - 현재 연도 사용
                year = new Date().getFullYear();
                month = parseInt(dateParts[0]) - 1; // 0-based
                day = parseInt(dateParts[1]);
            } else {
                throw new Error('날짜 형식이 올바르지 않습니다');
            }
            
            reportTime = new Date(year, month, day, 
                parseInt(timeParts[0]), // hour
                parseInt(timeParts[1])  // minute
            );
            
            // 현재 시간과 비교하여 미래 시간인지 확인
            const now = new Date();
            if (reportTime > now) {
                // 미래 시간인 경우 현재 시간으로 조정
                reportTime = now;
            }
            
            // 출발 시간 표시 (MM/DD HH:MM 형식)
            timeString = `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')} ${String(parseInt(timeParts[0])).padStart(2, '0')}:${String(parseInt(timeParts[1])).padStart(2, '0')}`;
        } catch (e) {
            // 파싱 실패 시 created_at 사용
            console.error('시간 파싱 오류:', e, 'departureTime:', report.departure_time);
            reportTime = new Date(report.created_at);
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const reportDate = new Date(reportTime.getFullYear(), reportTime.getMonth(), reportTime.getDate());

            if (reportDate.getTime() === today.getTime()) {
                // 오늘인 경우 시간만 표시
                timeString = reportTime.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            } else {
                // 다른 날인 경우 날짜와 시간 표시
                timeString = reportTime.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit'
                }) + ' ' + reportTime.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
        }
    } else {
        // departure_time이 없으면 created_at 사용
        // 한국 시간 형식인지 확인하고 파싱
        let reportTime;
        
        console.log('🔍 표시할 created_at 원본:', report.created_at);
        
        if (report.created_at && report.created_at.includes('T') && !report.created_at.includes('Z')) {
            // 한국 시간 형식 (예: "2025-08-07T21:20:00")
            const [datePart, timePart] = report.created_at.split('T');
            const [year, month, day] = datePart.split('-');
            const [hour, minute] = timePart.split(':');
            
            reportTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
            console.log('🔍 한국 시간 파싱 결과:', reportTime.toISOString());
        } else {
            // UTC 형식 (기존 데이터)
            reportTime = new Date(report.created_at);
            console.log('🔍 UTC 시간 파싱 결과:', reportTime.toISOString());
        }
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const reportDate = new Date(reportTime.getFullYear(), reportTime.getMonth(), reportTime.getDate());

        if (reportDate.getTime() === today.getTime()) {
            // 오늘인 경우 시간만 표시
            timeString = reportTime.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } else {
            // 다른 날인 경우 날짜와 시간 표시
            timeString = reportTime.toLocaleDateString('ko-KR', {
                month: '2-digit',
                day: '2-digit'
            }) + ' ' + reportTime.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }

    // 단순 인원보고 판별 (운행횟수에 포함되지 않는 보고)
    const isSimpleReport = report.exclude_from_matching === true;
    
    // 디버깅용 로그
    console.log('Report ID:', report.id, 'Time:', timeString, 'Shuttle Type:', report.shuttle_type, 'Exclude from matching:', report.exclude_from_matching, 'Is Simple:', isSimpleReport);
    const directionEmoji = report.direction === '출근' ? '🚌' : '🏠';
    const directionColor = report.direction === '출근' ? 'text-blue-600' : 'text-green-600';

    const reportDiv = document.createElement('div');
    reportDiv.className = `border rounded-lg p-4 mb-3 fade-in departure-card`;
    
    // 출발지별 배경색 적용 (Flutter 앱과 동일)
    const departure = report.departure || '';
    const departureBackgroundColor = getDepartureBackgroundColor(departure);
    const departureBorderColor = getDepartureBorderColor(departure);
    const departureTextColor = getDepartureTextColor(departure);
    
    // 단순 인원보고인 경우 우선순위로 주황색 적용, 아니면 출발지별 색상 적용
    if (isSimpleReport) {
        reportDiv.style.backgroundColor = '#fff7ed';
        reportDiv.style.borderLeft = '4px solid #f97316';
        reportDiv.style.borderColor = '#f97316';
        reportDiv.style.color = '#9a3412'; // 단순보고 텍스트 색상
    } else {
        reportDiv.style.backgroundColor = departureBackgroundColor;
        reportDiv.style.borderLeft = `4px solid ${departureBorderColor}`;
        reportDiv.style.borderColor = departureBorderColor;
        reportDiv.style.color = departureTextColor;
    }
    // 텍스트 색상 결정 (단순보고일 때와 일반 보고일 때 구분)
    const mainTextColor = isSimpleReport ? '#9a3412' : departureTextColor;
    const subTextColor = isSimpleReport ? '#c2410c' : '#6b7280';
    
    reportDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span class="text-sm font-semibold" style="color: ${mainTextColor};">
                        ${report.driver_name ? report.driver_name.charAt(0) : '?'}
                    </span>
                </div>
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="font-semibold" style="color: ${mainTextColor};">${report.driver_name || '알 수 없음'}</span>
                        <span class="text-xs px-2 py-1 rounded-full ${directionColor} bg-opacity-10 ${directionColor.replace('text-', 'bg-')}">
                            ${report.direction}
                        </span>
                        ${isSimpleReport ? '<span class="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-600">단순보고</span>' : ''}
                    </div>
                    <div class="text-sm" style="color: ${subTextColor};">
                        ${directionEmoji} ${report.departure} / ${report.passenger_count}명
                        ${report.shuttle_type ? `/ ${report.shuttle_type}` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <span class="text-xs" style="color: ${subTextColor};">${timeString}</span>
                <button onclick="editReport('${report.id}')" class="text-blue-500 hover:text-blue-700">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteReport('${report.id}')" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    return reportDiv;
}

async function editReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    // 모달 필드 설정
    document.getElementById('editDriverName').value = report.driver_name || '';
    document.getElementById('editDirection').value = report.direction || '출근';
    document.getElementById('editDeparture').value = report.departure || '';
    document.getElementById('editPassengerCount').value = report.passenger_count || 0;

    // 모달에 reportId 저장
    editForm.dataset.reportId = reportId;
    
    showEditModal();
}

async function handleEditSubmit(e) {
    e.preventDefault();
    
    const reportId = editForm.dataset.reportId;
    const driverName = document.getElementById('editDriverName').value;
    const direction = document.getElementById('editDirection').value;
    const departure = document.getElementById('editDeparture').value;
    const passengerCount = parseInt(document.getElementById('editPassengerCount').value);

    try {
        const { error } = await supabase
            .from('shuttle_reports')
            .update({
                driver_name: driverName,
                direction: direction,
                departure: departure,
                passenger_count: passengerCount
            })
            .eq('id', reportId);

        if (error) throw error;

        hideEditModal();
        await loadDashboardData();
        showNotification('인원보고가 수정되었습니다.', 'success');
    } catch (error) {
        console.error('수정 오류:', error);
        showNotification('수정에 실패했습니다.', 'error');
    }
}

async function handleAddSubmit(e) {
    e.preventDefault();
    
    // 관리자 권한 확인
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('관리자만 추가할 수 있습니다.', 'error');
        return;
    }
    
    const driverName = document.getElementById('addDriverName').value.trim();
    const direction = document.getElementById('addDirection').value;
    const departure = document.getElementById('addDeparture').value.trim();
    const passengerCount = parseInt(document.getElementById('addPassengerCount').value);
    const shuttleType = document.getElementById('addShuttleType').value;
    const dateTime = document.getElementById('addDateTime').value;
    const excludeFromMatching = document.getElementById('addExcludeFromMatching').checked;

    // 입력값 검증
    if (!driverName || !departure || passengerCount < 0 || passengerCount > 45) {
        showNotification('모든 필수 항목을 올바르게 입력해주세요.', 'error');
        return;
    }

    try {
        showLoadingScreen();
        
        // 한국 시간을 그대로 저장 (UTC 변환 없이)
        const reportData = {
            driver_name: driverName,
            direction: direction,
            departure: departure,
            passenger_count: passengerCount,
            shuttle_type: shuttleType,
            created_at: dateTime + ':00', // 한국 시간 그대로 저장 (UTC 변환 없이)
            departure_time: '', // 빈 문자열로 저장 (NOT NULL 제약 조건 해결)
            exclude_from_matching: excludeFromMatching
        };
        
        console.log('🔍 저장할 created_at 값:', reportData.created_at);
        console.log('🔍 저장할 created_at 타입:', typeof reportData.created_at);

        console.log('🚀 === 새 보고서 추가 시작 ===');
        console.log('📝 새 보고서 데이터:', reportData);
        console.log('⏰ created_at 값:', reportData.created_at);
        console.log('📊 created_at 타입:', typeof reportData.created_at);

        let data, error;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`🔄 저장 시도 ${retryCount + 1}/${maxRetries}`);
                const result = await supabase
                    .from('shuttle_reports')
                    .insert([reportData]);
                
                data = result.data;
                error = result.error;
                
                if (!error) {
                    console.log('✅ 저장 성공:', data);
                    break;
                } else {
                    throw error;
                }
            } catch (err) {
                retryCount++;
                console.error(`❌ 저장 시도 ${retryCount} 실패:`, err);
                
                if (retryCount >= maxRetries) {
                    error = err;
                    break;
                }
                
                // 1초 대기 후 재시도
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (error) {
            console.error('❌ Supabase 저장 오류 (최종):', error);
            throw error;
        }
        
        console.log('✅ 저장 성공:', data);
        console.log('🎉 === 새 보고서 추가 완료 ===');

        hideAddModal();
        await loadDashboardData();
        showNotification('새 인원보고가 추가되었습니다.', 'success');
        
    } catch (error) {
        console.error('추가 오류:', error);
        showNotification('추가에 실패했습니다: ' + error.message, 'error');
    } finally {
        hideLoadingScreen();
    }
}

async function deleteReport(reportId) {
    if (!confirm('이 인원보고를 삭제하시겠습니까?')) return;

    try {
        const { error } = await supabase
            .from('shuttle_reports')
            .delete()
            .eq('id', reportId);

        if (error) throw error;

        await loadDashboardData();
        showNotification('인원보고가 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('삭제 오류:', error);
        showNotification('삭제에 실패했습니다.', 'error');
    }
}

// 실시간 구독 기능 제거 - 새로고침 버튼으로만 데이터 업데이트
function setupRealtimeSubscription() {
    console.log('실시간 구독 기능이 비활성화되었습니다.');
    console.log('데이터 새로고침 버튼을 사용하여 데이터를 업데이트하세요.');
}

// 실시간 연결 상태 표시 함수 제거됨 (더 이상 사용하지 않음)
function updateRealtimeStatus(status, message) {
    // 실시간 상태 표시 기능이 제거되었습니다
}

// 실시간 연결 테스트 함수 (수정됨 - 새로고침 기능으로 변경)
async function testRealtimeConnection() {
    console.log('🔄 === 데이터 새로고침 테스트 시작 ===');
    showNotification('데이터를 새로고침합니다...', 'info');
    
    try {
        // 데이터 새로고침
        await loadDashboardData();
        showNotification('데이터 새로고침 완료!', 'success');
        console.log('✅ 데이터 새로고침 성공');
        
    } catch (error) {
        console.error('❌ 데이터 새로고침 실패:', error);
        showNotification('데이터 새로고침 실패: ' + error.message, 'error');
    }
}

// 탭 전환 함수 제거 (통합 대시보드로 변경)

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeString;
}

function updatePeriodDisplay() {
    const period = document.getElementById('periodSelect').value;
    const selectedDate = new Date(selectedDateInput.value);
    
    let displayText = '';
    
    switch (period) {
        case 'today':
            displayText = selectedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            break;
        case 'week':
            const dayOfWeek = selectedDate.getDay();
            const monday = new Date(selectedDate);
            monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            const mondayStr = monday.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const sundayStr = sunday.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            displayText = `${mondayStr} - ${sundayStr}`;
            break;
        case 'month':
            displayText = selectedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long'
            });
            break;
        case 'lastMonth':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            
            let previousMonth, previousYear;
            if (currentMonth === 0) {
                previousMonth = 11;
                previousYear = currentYear - 1;
            } else {
                previousMonth = currentMonth - 1;
                previousYear = currentYear;
            }
            
            const previousMonthDate = new Date(previousYear, previousMonth, 1);
            displayText = previousMonthDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long'
            });
            break;
        default:
            displayText = selectedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
    }
    
    if (periodDisplay) {
        periodDisplay.textContent = displayText;
    }
}

function showLoadingScreen() {
    loadingScreen.classList.remove('hidden');
}

function hideLoadingScreen() {
    loadingScreen.classList.add('hidden');
}

function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
}

function showAdminScreen() {
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
}

function showEditModal() {
    editModal.classList.remove('hidden');
}

function hideEditModal() {
    editModal.classList.add('hidden');
    editForm.reset();
}

function showAddModal() {
    // 관리자 권한 확인
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('관리자만 추가할 수 있습니다.', 'error');
        return;
    }
    
    // 현재 날짜/시간을 기본값으로 설정
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('addDateTime').value = localDateTime;
    
    // 폼 초기화
    addForm.reset();
    document.getElementById('addDateTime').value = localDateTime;
    
    addModal.classList.remove('hidden');
}

function hideAddModal() {
    addModal.classList.add('hidden');
    addForm.reset();
}

function showNotification(message, type = 'info') {
    // 간단한 알림 표시 (실제 구현에서는 더 정교한 알림 시스템 사용)
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 반응형 디자인을 위한 화면 크기 감지
function handleResize() {
    const isMobile = window.innerWidth < 768;
    
    // 모바일에서는 탭을 세로로 배치
    const tabNav = document.querySelector('nav.-mb-px');
    if (tabNav) {
        tabNav.className = isMobile 
            ? '-mb-px flex flex-col space-y-2' 
            : '-mb-px flex space-x-8';
    }
}

// 운행통계 관련 함수들
let departureChart = null;
let detailedTimeChart = null;

async function loadStatisticsData() {
    const period = document.getElementById('periodSelect').value;
    
    console.log('기간 선택 변경:', period);
    console.log('전체 데이터 수:', allReports.length);
    
    try {
        showLoadingScreen();
        
        // 기사별 운행 통계만 기간 선택 적용
        updateDriverStatistics(period);
        
        // 다른 통계들은 기간 선택 없이 오늘 날짜 기준으로 유지
        updateDepartureChart();
        updateDepartureStatusTable();
        
    } catch (error) {
        console.error('통계 데이터 로드 오류:', error);
        showNotification('통계 데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
        hideLoadingScreen();
    }
}

function updateDriverStatistics(period = 'today') {
    const driverStats = calculateDriverStatistics(period);
    const tableBody = document.getElementById('driverStatsTable');
    
    // 기사 필터 적용
    let filteredDriverStats = driverStats;
    if (selectedDriverFilter !== 'all') {
        filteredDriverStats = driverStats.filter(driver => driver.name === selectedDriverFilter);
    }
    
    // 기사 목록 업데이트
    updateDriverFilterOptions(driverStats);
    
    tableBody.innerHTML = '';
    
    filteredDriverStats.forEach(driver => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span class="text-sm font-medium text-blue-600">${driver.name.charAt(0)}</span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${driver.name}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${driver.operations}회</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${driver.previousMonthOps}회</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="showDriverDetail('${driver.name}', '${period}')" class="text-blue-600 hover:text-blue-900">
                    상세보기
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 특정 날짜에 대한 기사별 통계 업데이트
function updateDriverStatisticsForDate(selectedDate) {
    console.log('특정 날짜 기사별 통계 업데이트:', selectedDate);
    
    const driverStats = calculateDriverStatisticsForDate(selectedDate);
    const tableBody = document.getElementById('driverStatsTable');
    
    // 기사 필터 적용
    let filteredDriverStats = driverStats;
    if (selectedDriverFilter !== 'all') {
        filteredDriverStats = driverStats.filter(driver => driver.name === selectedDriverFilter);
    }
    
    // 기사 목록 업데이트
    updateDriverFilterOptions(driverStats);
    
    tableBody.innerHTML = '';
    
    filteredDriverStats.forEach(driver => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span class="text-sm font-medium text-blue-600">${driver.name.charAt(0)}</span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${driver.name}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${driver.operations}회</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${driver.previousMonthOps}회</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="showDriverDetailForDate('${driver.name}', '${selectedDate}')" class="text-blue-600 hover:text-blue-900">
                    상세보기
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateDriverFilterOptions(driverStats) {
    const driverFilterSelect = document.getElementById('driverFilterSelect');
    const currentValue = driverFilterSelect.value;
    
    // 기존 옵션 제거 (전체 기사 제외)
    const allOption = driverFilterSelect.querySelector('option[value="all"]');
    driverFilterSelect.innerHTML = '';
    driverFilterSelect.appendChild(allOption);
    
    // 기사 목록 추가
    driverStats.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.name;
        option.textContent = driver.name;
        driverFilterSelect.appendChild(option);
    });
    
    // 현재 선택된 값 유지 (해당 기사가 여전히 존재하는 경우)
    if (currentValue && (currentValue === 'all' || driverStats.some(d => d.name === currentValue))) {
        driverFilterSelect.value = currentValue;
    } else {
        driverFilterSelect.value = 'all';
        selectedDriverFilter = 'all';
    }
}

// 전월 운행 횟수 계산 함수
function calculatePreviousMonthOperations(driverName, period) {
    const selectedDate = new Date(selectedDateInput.value);
    let previousMonthStart, previousMonthEnd;
    
    console.log('전월 계산 - 선택된 날짜:', selectedDateInput.value);
    console.log('전월 계산 - selectedDate 객체:', selectedDate);
    console.log('전월 계산 - period:', period);
    
    // 기간 선택에 따라 기준 날짜 결정
    let baseDate = selectedDate;
    
    if (period === 'lastMonth') {
        // 저번달을 선택한 경우, 저번달의 전월을 계산해야 함
        const currentMonth = selectedDate.getMonth();
        const currentYear = selectedDate.getFullYear();
        
        let lastMonth, lastYear;
        if (currentMonth === 0) { // 1월인 경우
            lastMonth = 11; // 12월
            lastYear = currentYear - 1;
        } else {
            lastMonth = currentMonth - 1;
            lastYear = currentYear;
        }
        
        // 저번달의 1일을 기준으로 설정
        baseDate = new Date(lastYear, lastMonth, 1);
        console.log('저번달 선택 - 기준 날짜를 저번달 1일로 설정:', baseDate.toISOString());
    }
    
    // 전월 시작일과 종료일 계산 (개선된 방식)
    const currentMonth = baseDate.getMonth(); // 0-based month
    const currentYear = baseDate.getFullYear();
    
    // 전월 계산 (연도 변경 고려)
    let previousMonth, previousYear;
    if (currentMonth === 0) { // 1월인 경우
        previousMonth = 11; // 12월
        previousYear = currentYear - 1;
    } else {
        previousMonth = currentMonth - 1;
        previousYear = currentYear;
    }
    
    // 전월 시작일: 이전 월의 1일 (한국 시간으로 생성)
    previousMonthStart = new Date(previousYear, previousMonth, 1);
    
    // 전월 종료일: 이전 월의 마지막 날 (한국 시간으로 생성)
    previousMonthEnd = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
    
    console.log('전월 계산 - currentMonth:', currentMonth, '(0-based)');
    console.log('전월 계산 - previousMonth:', previousMonth, '(0-based)');
    console.log('전월 계산 - previousYear:', previousYear);
    console.log('전월 계산 - previousMonthStart:', previousMonthStart);
    console.log('전월 계산 - previousMonthEnd:', previousMonthEnd);
    
    console.log(`전월 운행 계산: ${driverName}`, {
        selectedDate: selectedDate.toISOString(),
        baseDate: baseDate.toISOString(),
        currentMonth: currentMonth,
        previousMonth: previousMonth,
        previousYear: previousYear,
        previousMonthStart: previousMonthStart.toISOString(),
        previousMonthEnd: previousMonthEnd.toISOString(),
        // 한국 시간으로 표시 (디버깅용)
        previousMonthStartLocal: previousMonthStart.toLocaleDateString('ko-KR'),
        previousMonthEndLocal: previousMonthEnd.toLocaleDateString('ko-KR'),
        // 월 정보 추가
        previousMonthName: previousMonthStart.toLocaleDateString('ko-KR', { month: 'long' })
    });
    
    // 앱과 동일한 방식으로 전월 운행 횟수 계산
    // 전체 데이터에서 날짜별로 매칭 후 기사별 카운팅
    let operationCount = 0;
    let currentDate = new Date(previousMonthStart);
    const dailyOperations = [];
    
    while (currentDate <= previousMonthEnd) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        // 앱과 동일하게 기사별로 카운팅
        const driverPairs = completedPairs.filter(pair => pair.commuteReport.driver_name === driverName);
        const dailyCount = driverPairs.length;
        
        if (dailyCount > 0) {
            dailyOperations.push({
                date: currentDate.toISOString().split('T')[0],
                count: dailyCount,
                pairs: driverPairs.map(p => `${p.commuteReport.direction}(${p.commuteReport.created_at})`)
            });
        }
        
        operationCount += dailyCount;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`전월 데이터: ${driverName}`, { 
        totalReports: allReports.length, 
        baseDate: baseDate.toISOString(),
        previousMonthStart: previousMonthStart.toISOString(),
        previousMonthEnd: previousMonthEnd.toISOString(),
        // 한국 시간으로 표시 (디버깅용)
        previousMonthStartLocal: previousMonthStart.toLocaleDateString('ko-KR'),
        previousMonthEndLocal: previousMonthEnd.toLocaleDateString('ko-KR'),
        totalDays: Math.ceil((previousMonthEnd - previousMonthStart) / (1000 * 60 * 60 * 24)),
        // 월 정보 추가
        previousMonthName: previousMonthStart.toLocaleDateString('ko-KR', { month: 'long' })
    });
    
    console.log(`전월 운행 횟수: ${driverName} = ${operationCount}회`, {
        dailyOperations: dailyOperations,
        totalDays: dailyOperations.length
    });
    
    return operationCount;
}

// 특정 날짜에 대한 기사별 통계 계산
function calculateDriverStatisticsForDate(selectedDate) {
    console.log('특정 날짜 기사별 통계 계산:', selectedDate);
    
    const driverStats = {};
    const targetDate = new Date(selectedDate + 'T00:00:00+09:00'); // 한국 시간대 명시
    
    // 해당 날짜의 완성된 운행 찾기
    const completedPairs = findCompletedOperations(allReports, targetDate);
    
    console.log(`특정 날짜 통계 계산: ${selectedDate}`, { 
        totalReports: allReports.length, 
        completedPairs: completedPairs.length 
    });
    
    // 기사별로 운행 횟수 계산
    completedPairs.forEach(pair => {
        const driverName = pair.commuteReport.driver_name;
        if (!driverStats[driverName]) {
            driverStats[driverName] = {
                name: driverName,
                operations: 0,
                previousMonthOps: calculatePreviousMonthOperationsForDate(driverName, selectedDate)
            };
        }
        driverStats[driverName].operations++;
    });
    
    // 결과를 배열로 변환
    const result = Object.values(driverStats);
    console.log('특정 날짜 기사별 통계 결과:', result);
    
    return result;
}

// 특정 날짜 기준 전월 운행 횟수 계산
function calculatePreviousMonthOperationsForDate(driverName, selectedDate) {
    const targetDate = new Date(selectedDate + 'T00:00:00+09:00');
    
    // 전월 시작일과 종료일 계산
    const currentMonth = targetDate.getMonth();
    const currentYear = targetDate.getFullYear();
    
    let previousMonth, previousYear;
    if (currentMonth === 0) { // 1월인 경우
        previousMonth = 11; // 12월
        previousYear = currentYear - 1;
    } else {
        previousMonth = currentMonth - 1;
        previousYear = currentYear;
    }
    
    const previousMonthStart = new Date(previousYear, previousMonth, 1);
    const previousMonthEnd = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
    
    console.log(`전월 운행 계산 (특정 날짜 기준): ${driverName}`, {
        selectedDate: selectedDate,
        targetDate: targetDate.toISOString(),
        previousMonthStart: previousMonthStart.toISOString(),
        previousMonthEnd: previousMonthEnd.toISOString()
    });
    
    // 전월 운행 횟수 계산
    let operationCount = 0;
    let currentDate = new Date(previousMonthStart);
    
    while (currentDate <= previousMonthEnd) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        const driverPairs = completedPairs.filter(pair => pair.commuteReport.driver_name === driverName);
        operationCount += driverPairs.length;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return operationCount;
}

function calculateDriverStatistics(period = 'today') {
    const driverStats = {};
    
            // 기간별 데이터 필터링 (전체 데이터 사용)
        const filteredReports = filterReportsByPeriod(allReports, period);
        
        console.log(`기사별 통계 계산: ${period}`, { 
            totalReports: allReports.length, 
            filteredReports: filteredReports.length 
        });
        
        // 기간의 시작과 끝 날짜 계산
        const selectedDate = new Date(selectedDateInput.value);
        let startDate, endDate;
        
        console.log('기간별 통계 계산 - 선택된 날짜:', selectedDateInput.value);
        console.log('기간별 통계 계산 - selectedDate 객체:', selectedDate);
        console.log('기간별 통계 계산 - period:', period);
        
        switch (period) {
            case 'today':
                startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
                break;
            case 'week':
                const dayOfWeek = selectedDate.getDay();
                const monday = new Date(selectedDate);
                monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
                startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
                endDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
                break;
            case 'month':
                startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'lastMonth':
                // 전월 시작일과 종료일 계산
                const currentMonth = selectedDate.getMonth();
                const currentYear = selectedDate.getFullYear();
                
                let previousMonth, previousYear;
                if (currentMonth === 0) { // 1월인 경우
                    previousMonth = 11; // 12월
                    previousYear = currentYear - 1;
                } else {
                    previousMonth = currentMonth - 1;
                    previousYear = currentYear;
                }
                
                startDate = new Date(previousYear, previousMonth, 1);
                endDate = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
                break;
            default:
                startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
        }
    
    console.log('기간별 통계 계산 - startDate:', startDate);
    console.log('기간별 통계 계산 - endDate:', endDate);
    // 한국 시간으로 표시 (디버깅용)
    console.log('기간별 통계 계산 - startDate (한국시간):', startDate.toLocaleDateString('ko-KR'));
    console.log('기간별 통계 계산 - endDate (한국시간):', endDate.toLocaleDateString('ko-KR'));
    
    // 기사별 운행 횟수 계산 - 앱과 동일한 로직
    const driverOperations = {};
    
    // 각 날짜별로 기사별 운행 횟수 계산
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        
        for (const pair of completedPairs) {
            const driverName = pair.commuteReport.driver_name;
            driverOperations[driverName] = (driverOperations[driverName] || 0) + 1;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 기사별 통계 생성
    filteredReports.forEach(report => {
        const driverName = report.driver_name || '알 수 없음';
        
        if (!driverStats[driverName]) {
            driverStats[driverName] = {
                name: driverName,
                operations: driverOperations[driverName] || 0,
                previousMonthOps: calculatePreviousMonthOperations(driverName, period),
                reports: []
            };
        }
        
        driverStats[driverName].reports.push(report);
    });
    
    return Object.values(driverStats).sort((a, b) => b.operations - a.operations);
}

function updateDepartureChart() {
    const departureData = calculateDepartureStatistics();
    
    const ctx = document.getElementById('departureChart').getContext('2d');
    
    if (departureChart) {
        departureChart.destroy();
    }

    departureChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: departureData.labels,
            datasets: [{
                data: departureData.data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            }
        }
    });
}

function calculateDepartureStatistics() {
    const departureCounts = {};
    
    // 메인 대시보드와 동일한 데이터 사용
    reports.forEach(report => {
        const departure = report.departure || '알 수 없음';
        departureCounts[departure] = (departureCounts[departure] || 0) + report.passenger_count;
    });
    
    // 총합 계산
    const total = Object.values(departureCounts).reduce((sum, count) => sum + count, 0);
    
    // 퍼센트로 변환
    const departurePercentages = {};
    Object.keys(departureCounts).forEach(departure => {
        departurePercentages[departure] = total > 0 ? Math.round((departureCounts[departure] / total) * 100) : 0;
    });
    
    return {
        labels: Object.keys(departurePercentages),
        data: Object.values(departurePercentages)
    };
}

function updateDepartureStatusTable() {
    const departureStatus = calculateDepartureStatus();
    const tableContainer = document.getElementById('departureStatusTable');
    
    if (departureStatus.length === 0) {
        tableContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-table text-4xl mb-4"></i>
                <p>선택된 날짜에 데이터가 없습니다</p>
            </div>
        `;
        return;
    }
    
    let tableHtml = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-orange-50">
                <tr>
                    <th class="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider">탑승지</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider">출근</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider">퇴근</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider">남은 인원</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    departureStatus.forEach(status => {
        const remainingClass = status.remaining > 0 ? 'text-red-600 font-semibold' : 
                             status.remaining < 0 ? 'text-blue-600 font-semibold' : 'text-gray-900';
        
        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">${status.name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">${status.commute}명</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">${status.offWork}명</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${remainingClass} text-center">${status.remaining}명</td>
            </tr>
        `;
    });
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHtml;
}

function calculateDepartureStatus() {
    const departureStatus = {};
    
    // 선택된 날짜의 데이터만 필터링
    const selectedDate = new Date(selectedDateInput.value);
    const filteredReports = reports.filter(report => {
        // 데이터베이스에 이미 한국 시간이 저장되어 있으므로 변환 불필요
        const reportDate = new Date(report.created_at);
        
        return isSameDate(reportDate, selectedDate);
    });
    
    // 출발지별 통계 계산
    filteredReports.forEach(report => {
        const departure = report.departure || '';
        const direction = report.direction || '';
        const count = report.passenger_count || 0;
        
        if (!departureStatus[departure]) {
            departureStatus[departure] = { commute: 0, offWork: 0, remaining: 0 };
        }
        
        if (direction === '출근') {
            departureStatus[departure].commute += count;
            departureStatus[departure].remaining += count;
        } else if (direction === '퇴근') {
            departureStatus[departure].offWork += count;
            departureStatus[departure].remaining -= count;
        }
    });
    
    // 출발지별 데이터를 리스트로 변환
    const departureList = Object.entries(departureStatus).map(([name, data]) => ({
        name: name,
        commute: data.commute,
        offWork: data.offWork,
        remaining: data.remaining
    }));
    
    // 독성리와 가좌리를 맨 위로 정렬
    departureList.sort((a, b) => {
        if (a.name === '독성리') return -1;
        if (b.name === '독성리') return 1;
        if (a.name === '가좌리') return -1;
        if (b.name === '가좌리') return 1;
        return a.name.localeCompare(b.name);
    });
    
    return departureList;
}

function showDriverDetail(driverName, period = 'today') {
    const driverReports = filterReportsByPeriod(allReports, period).filter(report => report.driver_name === driverName);
    
    // 기간별 완성된 운행 계산
    const selectedDate = new Date(selectedDateInput.value);
    let startDate, endDate;
    
    switch (period) {
        case 'today':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = selectedDate.getDay();
            const monday = new Date(selectedDate);
            monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
            endDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'lastMonth':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            let lastMonth, lastYear;
            if (currentMonth === 0) {
                lastMonth = 11;
                lastYear = currentYear - 1;
            } else {
                lastMonth = currentMonth - 1;
                lastYear = currentYear;
            }
            startDate = new Date(lastYear, lastMonth, 1);
            endDate = new Date(lastYear, lastMonth + 1, 0, 23, 59, 59);
            break;
        default:
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    }
    
    // 기간 내 모든 날짜의 완성된 운행 계산
    let totalCompletedOperations = 0;
    const completedReportIds = new Map(); // reportId -> {matchIndex, matchType}
    let currentDate = new Date(startDate);
    let normalMatchIndex = 0; // 일반 매칭 인덱스
    
    while (currentDate <= endDate) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        const driverCompletedPairs = completedPairs.filter(pair => 
            pair.commuteReport.driver_name === driverName || 
            pair.offWorkReport.driver_name === driverName
        );
        
        totalCompletedOperations += driverCompletedPairs.length;
        driverCompletedPairs.forEach(pair => {
            // 매칭 타입 판단
            const matchType = determineMatchingType(pair.commuteReport, pair.offWorkReport, allReports, currentDate);
            
            if (matchType === MATCHING_TYPES.NORMAL) {
                // 일반 매칭: 순차적으로 인덱스 할당
                completedReportIds.set(pair.commuteReport.id, { matchIndex: normalMatchIndex, matchType: matchType });
                completedReportIds.set(pair.offWorkReport.id, { matchIndex: normalMatchIndex, matchType: matchType });
                normalMatchIndex++;
            } else {
                // 나중에 완성된 매칭
                completedReportIds.set(pair.commuteReport.id, { matchIndex: -1, matchType: matchType });
                completedReportIds.set(pair.offWorkReport.id, { matchIndex: -1, matchType: matchType });
            }
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('기간별 상세보기 계산:', {
        period: period,
        totalReports: driverReports.length,
        totalCompletedOperations: totalCompletedOperations,
        completedReportIds: Object.fromEntries(completedReportIds)
    });
    
    // 완성된 운행 쌍에서 출발지별 운행 횟수 계산
    const departureCounts = {};
    let departureCalcDate = new Date(startDate);
    
    while (departureCalcDate <= endDate) {
        const completedPairs = findCompletedOperations(allReports, departureCalcDate);
        const driverCompletedPairs = completedPairs.filter(pair => 
            pair.commuteReport.driver_name === driverName || 
            pair.offWorkReport.driver_name === driverName
        );
        
        // 완성된 운행 쌍의 출근 보고서 출발지로 카운트
        driverCompletedPairs.forEach(pair => {
            const departure = pair.commuteReport.departure || '알 수 없음';
            departureCounts[departure] = (departureCounts[departure] || 0) + 1;
        });
        
        departureCalcDate.setDate(departureCalcDate.getDate() + 1);
    }
    
    // 출발지별 운행 횟수 텍스트 생성
    const departureText = Object.entries(departureCounts)
        .map(([departure, count]) => `${departure} ${count}회`)
        .join(', ');
    
    let detailHtml = `
        <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">${driverName} 기사님 상세 정보</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-sm text-blue-600">총 운행</div>
                    <div class="text-2xl font-bold text-blue-900">${totalCompletedOperations}회</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="text-sm text-purple-600">출발지별 운행 횟수</div>
                    <div class="text-lg font-bold text-purple-900">${departureText}</div>
                </div>
            </div>
            <div class="max-h-96 overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">날짜/시간</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">셔틀종류</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">출발지</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">방향</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">인원수</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">작업</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    driverReports.forEach(report => {
        const reportTime = new Date(report.created_at);
        const timeString = reportTime.toLocaleString('ko-KR');
        
        // 상태 분류 로직
        let statusText, statusClass, rowClass;
        
        if (report.exclude_from_matching === true) {
            // 단순 인원 보고
            statusText = '단순인원보고';
            statusClass = 'text-blue-600 font-medium';
            rowClass = 'bg-blue-50';
        } else if (completedReportIds.has(report.id)) {
            // 완성된 운행
            const matchInfo = completedReportIds.get(report.id);
            
            if (matchInfo.matchType === MATCHING_TYPES.LATE_COMPLETION) {
                // 나중에 완성된 매칭
                statusText = '나중완성';
                statusClass = MATCHING_COLORS.late.text + ' font-medium';
                rowClass = MATCHING_COLORS.late.bg;
            } else {
                // 일반 매칭
                const color = MATCHING_COLORS.normal[matchInfo.matchIndex % MATCHING_COLORS.normal.length];
                statusText = '완성';
                statusClass = color.text + ' font-medium';
                rowClass = color.bg;
            }
        } else {
            // 매칭 실패
            statusText = '매칭 실패';
            statusClass = 'text-red-600 font-medium';
            rowClass = 'bg-red-50';
        }
        
        detailHtml += `
            <tr class="${rowClass}">
                <td class="px-4 py-2 text-sm text-gray-900">${timeString}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.shuttle_type || '-'}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.departure}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.direction}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.passenger_count}명</td>
                <td class="px-4 py-2 text-sm ${statusClass}">${statusText}</td>
                <td class="px-4 py-2 text-sm text-gray-900">
                    <button onclick="editReportFromDetail('${report.id}')" class="text-blue-500 hover:text-blue-700 mr-2" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteReportFromDetail('${report.id}')" class="text-red-500 hover:text-red-700" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    detailHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // 모달로 표시
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[100]';
    modal.innerHTML = `
        <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div class="mt-3">
                ${detailHtml}
                <div class="flex justify-end mt-6">
                    <button onclick="this.closest('.fixed').remove()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md">
                        닫기
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 특정 날짜에 대한 기사 상세보기
function showDriverDetailForDate(driverName, selectedDate) {
    console.log('특정 날짜 기사 상세보기:', driverName, selectedDate);
    
    const targetDate = new Date(selectedDate + 'T00:00:00+09:00');
    
    // 해당 날짜의 기사 보고서만 필터링
    const driverReports = allReports.filter(report => {
        const reportDate = new Date(report.created_at);
        return isSameDate(reportDate, targetDate) && report.driver_name === driverName;
    });
    
    // 완성된 운행 쌍 계산
    const completedPairs = findCompletedOperations(allReports, targetDate);
    const driverCompletedPairs = completedPairs.filter(pair => 
        pair.commuteReport.driver_name === driverName || 
        pair.offWorkReport.driver_name === driverName
    );
    
    // 완성된 운행에 포함된 보고서 ID들 수집
    const completedReportIds = new Map(); // reportId -> {matchIndex, matchType}
    let normalMatchIndex = 0; // 일반 매칭 인덱스
    
    driverCompletedPairs.forEach(pair => {
        // 매칭 타입 판단
        const matchType = determineMatchingType(pair.commuteReport, pair.offWorkReport, allReports, targetDate);
        
        if (matchType === MATCHING_TYPES.NORMAL) {
            // 일반 매칭: 순차적으로 인덱스 할당
            completedReportIds.set(pair.commuteReport.id, { matchIndex: normalMatchIndex, matchType: matchType });
            completedReportIds.set(pair.offWorkReport.id, { matchIndex: normalMatchIndex, matchType: matchType });
            normalMatchIndex++;
        } else {
            // 나중에 완성된 매칭
            completedReportIds.set(pair.commuteReport.id, { matchIndex: -1, matchType: matchType });
            completedReportIds.set(pair.offWorkReport.id, { matchIndex: -1, matchType: matchType });
        }
    });
    
    console.log('상세보기 계산:', {
        totalReports: driverReports.length,
        completedPairs: driverCompletedPairs.length,
        completedReportIds: Object.fromEntries(completedReportIds)
    });
    
    // 완성된 운행 쌍에서 출발지별 운행 횟수 계산
    const departureCounts = {};
    
    // 완성된 운행 쌍의 출근 보고서 출발지로 카운트
    driverCompletedPairs.forEach(pair => {
        const departure = pair.commuteReport.departure || '알 수 없음';
        departureCounts[departure] = (departureCounts[departure] || 0) + 1;
    });
    
    // 출발지별 운행 횟수 텍스트 생성
    const departureText = Object.entries(departureCounts)
        .map(([departure, count]) => `${departure} ${count}회`)
        .join(', ');
    
    let detailHtml = `
        <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">${driverName} 기사님 상세 정보 (${selectedDate})</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-sm text-blue-600">총 운행</div>
                    <div class="text-2xl font-bold text-blue-900">${driverCompletedPairs.length}회</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="text-sm text-purple-600">출발지별 운행 횟수</div>
                    <div class="text-lg font-bold text-purple-900">${departureText}</div>
                </div>
            </div>
            <div class="max-h-96 overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">시간</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">셔틀종류</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">출발지</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">방향</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">인원수</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">작업</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    driverReports.forEach(report => {
        const reportTime = new Date(report.created_at);
        const timeString = reportTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // 상태 분류 로직
        let statusText, statusClass, rowClass;
        
        if (report.exclude_from_matching === true) {
            // 단순 인원 보고
            statusText = '단순인원보고';
            statusClass = 'text-blue-600 font-medium';
            rowClass = 'bg-blue-50';
        } else if (completedReportIds.has(report.id)) {
            // 완성된 운행
            const matchInfo = completedReportIds.get(report.id);
            
            if (matchInfo.matchType === MATCHING_TYPES.LATE_COMPLETION) {
                // 나중에 완성된 매칭
                statusText = '나중완성';
                statusClass = MATCHING_COLORS.late.text + ' font-medium';
                rowClass = MATCHING_COLORS.late.bg;
            } else {
                // 일반 매칭
                const color = MATCHING_COLORS.normal[matchInfo.matchIndex % MATCHING_COLORS.normal.length];
                statusText = '완성';
                statusClass = color.text + ' font-medium';
                rowClass = color.bg;
            }
        } else {
            // 매칭 실패
            statusText = '매칭 실패';
            statusClass = 'text-red-600 font-medium';
            rowClass = 'bg-red-50';
        }
        
        detailHtml += `
            <tr class="${rowClass}">
                <td class="px-4 py-2 text-sm text-gray-900">${timeString}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.shuttle_type || '-'}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.departure}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.direction}</td>
                <td class="px-4 py-2 text-sm text-gray-900">${report.passenger_count}명</td>
                <td class="px-4 py-2 text-sm ${statusClass}">${statusText}</td>
                <td class="px-4 py-2 text-sm text-gray-900">
                    <button onclick="editReportFromDetail('${report.id}')" class="text-blue-500 hover:text-blue-700 mr-2" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteReportFromDetail('${report.id}')" class="text-red-500 hover:text-red-700" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    detailHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // 모달로 표시
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[100]';
    modal.innerHTML = `
        <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div class="mt-3">
                ${detailHtml}
                <div class="flex justify-end mt-6">
                    <button onclick="this.closest('.fixed').remove()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md">
                        닫기
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 상세보기에서 수정 버튼 클릭 시
async function editReportFromDetail(reportId) {
    // 기존 수정 함수 호출
    await editReport(reportId);
    
    // 수정 모달이 닫힌 후 상세보기 새로고침을 위한 이벤트 리스너 추가
    const checkModalClosed = setInterval(() => {
        if (editModal.classList.contains('hidden')) {
            clearInterval(checkModalClosed);
            // 상세보기 새로고침
            refreshDriverDetail();
        }
    }, 100);
}

// 상세보기에서 삭제 버튼 클릭 시
async function deleteReportFromDetail(reportId) {
    // 기존 삭제 함수 호출
    await deleteReport(reportId);
    
    // 삭제 완료 후 상세보기 새로고침
    setTimeout(() => {
        refreshDriverDetail();
    }, 500);
}

// 상세보기 새로고침 함수
function refreshDriverDetail() {
    // 현재 열려있는 상세보기 모달 찾기
    const detailModal = document.querySelector('.fixed.inset-0.bg-gray-600.bg-opacity-50');
    if (detailModal) {
        // 모달 내용에서 기사명 추출
        const driverNameElement = detailModal.querySelector('h3');
        if (driverNameElement) {
            const driverName = driverNameElement.textContent.replace(' 기사님 상세 정보', '');
            const periodSelect = document.getElementById('periodSelect');
            const period = periodSelect ? periodSelect.value : 'today';
            
            // 상세보기 다시 열기
            showDriverDetail(driverName, period);
        }
    }
}

async function exportToExcel() {
    try {
        showNotification('엑셀 파일을 생성 중입니다...', 'info');
        
        // 기사 데이터가 로드되어 있지 않으면 로드
        if (!drivers || drivers.length === 0) {
            await loadDriversData();
        }
        
        // 현재 선택된 기간 가져오기
        const period = document.getElementById('periodSelect').value;
        const periodText = {
            'today': '오늘',
            'week': '이번주',
            'month': '이번달',
            'lastMonth': '저번달'
        }[period] || '오늘';
        
        // 기간별 데이터 필터링
        const filteredReports = filterReportsByPeriod(allReports, period);
        
        console.log(`엑셀 다운로드: ${periodText}`, { 
            totalReports: allReports.length, 
            filteredReports: filteredReports.length 
        });
        
        // ExcelJS 워크북 생성
        const workbook = new ExcelJS.Workbook();
        
        // 시트 1: 인원보고 상세
        const sheet1 = workbook.addWorksheet('인원보고 상세');
        createDetailedReportSheet(sheet1, filteredReports, periodText);
        
        // 시트 2: 기간별 통계
        const sheet2 = workbook.addWorksheet('기간별 통계');
        createPeriodStatsSheet(sheet2, filteredReports, periodText);
        
        // 시트 3: 기사별 통계
        const sheet3 = workbook.addWorksheet('기사별 통계');
        createDriverStatsSheet(sheet3, filteredReports, periodText);
        
        // 시트 4: 기사별 출발지 통계
        const sheet4 = workbook.addWorksheet('기사별 출발지 통계');
        createDriverDepartureStatsSheet(sheet4, filteredReports, periodText);
        
        // 엑셀 파일 다운로드
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const currentDate = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `셔틀_운행_통계_${periodText}_${currentDate}.xlsx`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`${periodText} 엑셀 파일이 다운로드되었습니다.`, 'success');
    } catch (error) {
        console.error('엑셀 다운로드 오류:', error);
        showNotification('엑셀 다운로드에 실패했습니다.', 'error');
    }
}

// 시트 1: 인원보고 상세 생성
function createDetailedReportSheet(sheet, reports, periodText) {
    // 헤더 설정
    const headers = [
        '날짜', '시간', '소속', '기사명', '셔틀타입', '출발지', '방향', '인원수', '단순보고여부'
    ];
    
    // 헤더 작성
    headers.forEach((header, index) => {
        const cell = sheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };
        cell.alignment = { horizontal: 'center' };
    });
    
    // 데이터 작성
    reports.forEach((report, rowIndex) => {
        const reportTime = new Date(report.created_at);
        const dateString = reportTime.toLocaleDateString('ko-KR');
        const timeString = reportTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const isSimpleReport = report.exclude_from_matching === true;
        
        // 기사명으로 소속 정보 찾기
        const driver = drivers.find(d => d.name === report.driver_name);
        const affiliation = driver ? (driver.affiliation || '') : '';
        
        const rowData = [
            dateString,
            timeString,
            affiliation,
            report.driver_name || '',
            report.shuttle_type || '',
            report.departure || '',
            report.direction || '',
            report.passenger_count || 0,
            isSimpleReport ? '단순보고' : '정상보고'
        ];
        
        rowData.forEach((value, colIndex) => {
            const cell = sheet.getCell(rowIndex + 2, colIndex + 1);
            cell.value = value;
            
            // 단순보고 행은 배경색 변경
            if (isSimpleReport) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFF3E0' }
                };
            }
        });
    });
    
    // 컬럼 너비 자동 조정
    sheet.columns.forEach(column => {
        column.width = 15;
    });
}

// 시트 2: 기간별 통계 생성
function createPeriodStatsSheet(sheet, reports, periodText) {
    // 기간별 통계 계산
    const totalReports = reports.length;
    const totalPassengers = reports.reduce((sum, r) => sum + (r.passenger_count || 0), 0);
    const simpleReports = reports.filter(r => r.exclude_from_matching === true).length;
    const normalReports = totalReports - simpleReports;
    
    // 완성된 운행 횟수 계산
    const selectedDate = new Date(selectedDateInput.value);
    let startDate, endDate;
    
    const period = document.getElementById('periodSelect').value;
    switch (period) {
        case 'today':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = selectedDate.getDay();
            const monday = new Date(selectedDate);
            monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
            endDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'lastMonth':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            let previousMonth, previousYear;
            if (currentMonth === 0) {
                previousMonth = 11;
                previousYear = currentYear - 1;
            } else {
                previousMonth = currentMonth - 1;
                previousYear = currentYear;
            }
            startDate = new Date(previousYear, previousMonth, 1);
            endDate = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
            break;
        default:
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    }
    
    let totalCompletedOperations = 0;
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        totalCompletedOperations += completedPairs.length;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 헤더
    const headers = ['구분', '총 운행횟수', '총 보고서', '총 승객수', '정상보고', '단순보고'];
    headers.forEach((header, index) => {
        const cell = sheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F5E8' }
        };
        cell.alignment = { horizontal: 'center' };
    });
    
    // 데이터
    const data = [
        periodText,
        totalCompletedOperations,
        totalReports,
        totalPassengers,
        normalReports,
        simpleReports
    ];
    
    data.forEach((value, index) => {
        const cell = sheet.getCell(2, index + 1);
        cell.value = value;
        cell.alignment = { horizontal: 'center' };
    });
    
    // 컬럼 너비 조정
    sheet.columns.forEach(column => {
        column.width = 15;
    });
}

// 시트 3: 기사별 통계 생성
function createDriverStatsSheet(sheet, reports, periodText) {
    // 기사별 통계 계산
    const driverStats = calculateDriverStatistics(document.getElementById('periodSelect').value);
    
    // 헤더
    const headers = ['기사명', '소속', '총 운행횟수', '전월 운행횟수', '총 승객수', '평균 승객수'];
    headers.forEach((header, index) => {
        const cell = sheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3E0' }
        };
        cell.alignment = { horizontal: 'center' };
    });
    
    // 데이터
    driverStats.forEach((driver, rowIndex) => {
        const totalPassengers = driver.reports.reduce((sum, r) => sum + (r.passenger_count || 0), 0);
        const avgPassengers = driver.operations > 0 ? Math.round(totalPassengers / driver.operations) : 0;
        
        // 기사명으로 소속 정보 찾기
        const driverInfo = drivers.find(d => d.name === driver.name);
        const affiliation = driverInfo ? (driverInfo.affiliation || '') : '';
        
        const rowData = [
            driver.name,
            affiliation,
            driver.operations,
            driver.previousMonthOps,
            totalPassengers,
            avgPassengers
        ];
        
        rowData.forEach((value, colIndex) => {
            const cell = sheet.getCell(rowIndex + 2, colIndex + 1);
            cell.value = value;
            cell.alignment = { horizontal: 'center' };
        });
    });
    
    // 컬럼 너비 조정
    sheet.columns.forEach(column => {
        column.width = 15;
    });
}

// 시트 4: 기사별 출발지 통계 생성
function createDriverDepartureStatsSheet(sheet, reports, periodText) {
    // 기사별 출발지 통계 계산
    const driverStats = calculateDriverStatistics(document.getElementById('periodSelect').value);
    const selectedDate = new Date(selectedDateInput.value);
    const period = document.getElementById('periodSelect').value;
    
    // 기간 계산
    let startDate, endDate;
    switch (period) {
        case 'today':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = selectedDate.getDay();
            const monday = new Date(selectedDate);
            monday.setDate(selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
            endDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'lastMonth':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            let previousMonth, previousYear;
            if (currentMonth === 0) {
                previousMonth = 11;
                previousYear = currentYear - 1;
            } else {
                previousMonth = currentMonth - 1;
                previousYear = currentYear;
            }
            startDate = new Date(previousYear, previousMonth, 1);
            endDate = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
            break;
        default:
            startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    }
    
    // 모든 출발지 수집
    const allDepartures = new Set();
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const completedPairs = findCompletedOperations(allReports, currentDate);
        completedPairs.forEach(pair => {
            allDepartures.add(pair.commuteReport.departure || '알 수 없음');
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const departureList = Array.from(allDepartures).sort();
    
    // 헤더 생성
    const headers = ['기사명', '소속', '총 운행', ...departureList];
    headers.forEach((header, index) => {
        const cell = sheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE1F5FE' }
        };
        cell.alignment = { horizontal: 'center' };
    });
    
    // 데이터 작성
    driverStats.forEach((driver, rowIndex) => {
        // 기사별 출발지별 운행 횟수 계산
        const departureCounts = {};
        currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const completedPairs = findCompletedOperations(allReports, currentDate);
            const driverCompletedPairs = completedPairs.filter(pair => 
                pair.commuteReport.driver_name === driver.name || 
                pair.offWorkReport.driver_name === driver.name
            );
            
            driverCompletedPairs.forEach(pair => {
                const departure = pair.commuteReport.departure || '알 수 없음';
                departureCounts[departure] = (departureCounts[departure] || 0) + 1;
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // 기사명으로 소속 정보 찾기
        const driverInfo = drivers.find(d => d.name === driver.name);
        const affiliation = driverInfo ? (driverInfo.affiliation || '') : '';
        
        // 행 데이터 생성
        const rowData = [
            driver.name,
            affiliation,
            driver.operations
        ];
        
        // 각 출발지별 횟수 추가
        departureList.forEach(departure => {
            rowData.push(departureCounts[departure] || 0);
        });
        
        // 데이터 작성
        rowData.forEach((value, colIndex) => {
            const cell = sheet.getCell(rowIndex + 2, colIndex + 1);
            cell.value = value;
            cell.alignment = { horizontal: 'center' };
        });
    });
    
    // 컬럼 너비 조정
    sheet.columns.forEach(column => {
        column.width = 12;
    });
}

window.addEventListener('resize', handleResize);
handleResize(); // 초기 실행

// 페이지 언로드 시 로그인 상태 유지 (새로고침 방지)
window.addEventListener('beforeunload', (e) => {
    // 로그인 상태가 있으면 새로고침 시에도 유지
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isLoggedIn) {
        console.log('페이지 언로드 - 로그인 상태 유지');
    }
});

// 브라우저 뒤로가기/앞으로가기 시 상태 복원
window.addEventListener('popstate', (e) => {
    console.log('브라우저 네비게이션 - 상태 복원 시도');
    // 로그인 상태 확인 및 복원
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    const savedUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
    
    if (isLoggedIn && savedUser && currentUser === null) {
        console.log('네비게이션으로 인한 로그인 상태 복원');
        currentUser = savedUser;
        showAdminScreen();
    }
});

// 미완성 운행 관련 함수들
async function checkIncompleteOperations() {
    try {
        // 전일 날짜 계산 (선택된 날짜의 전날) - 한국 시간대 기준
        const selectedDateObj = new Date(selectedDate + 'T00:00:00+09:00'); // 한국 시간대 명시
        const previousDate = new Date(selectedDateObj);
        previousDate.setDate(selectedDateObj.getDate() - 1);
        
        // 한국 시간대 기준으로 날짜 문자열 생성
        const year = previousDate.getFullYear();
        const month = String(previousDate.getMonth() + 1).padStart(2, '0');
        const day = String(previousDate.getDate()).padStart(2, '0');
        const previousDateStr = `${year}-${month}-${day}`;
        
        console.log('미완성 운행 체크 - 선택된 날짜:', selectedDate);
        console.log('미완성 운행 체크 - 전일:', previousDateStr);
        
        // 전일 데이터 필터링
        const previousDayReports = allReports.filter(report => {
            const reportDate = new Date(report.created_at);
            return isSameDate(reportDate, previousDate);
        });
        
        console.log('전일 보고서 수:', previousDayReports.length);
        
        // 미완성 운행 감지
        const incompleteOperations = findIncompleteOperations(previousDayReports, previousDate);
        
        // UI 업데이트
        updateIncompleteOperationsAlert(incompleteOperations, previousDateStr);
        
    } catch (error) {
        console.error('미완성 운행 체크 오류:', error);
    }
}

function findIncompleteOperations(reports, targetDate) {
    console.log('=== 미완성 운행 감지 시작 ===');
    console.log('전체 보고서 수:', reports.length);
    console.log('타겟 날짜:', targetDate.toISOString().split('T')[0]);
    
    // 셔틀 타입별로 그룹화
    const groupedByType = {};
    for (const report of reports) {
        if (report.shuttle_type === '근로자 셔틀' || report.shuttle_type === '직원 셔틀') {
            if (!report.exclude_from_matching) {
                if (!groupedByType[report.shuttle_type]) {
                    groupedByType[report.shuttle_type] = [];
                }
                groupedByType[report.shuttle_type].push(report);
            }
        }
    }
    
    // 각 셔틀 타입별로 미완성 운행 찾기
    const incompleteOperations = [];
    
    for (const [shuttleType, typeReports] of Object.entries(groupedByType)) {
        console.log('미완성 운행 체크:', shuttleType, `(${typeReports.length}개 보고서)`);
        
        // 기사별로 그룹화
        const driverGroups = {};
        for (const report of typeReports) {
            if (!driverGroups[report.driver_name]) {
                driverGroups[report.driver_name] = [];
            }
            driverGroups[report.driver_name].push(report);
        }
        
        // 각 기사별로 미완성 운행 체크
        for (const [driverName, driverReports] of Object.entries(driverGroups)) {
            const commuteReports = driverReports.filter(r => r.direction === '출근');
            const offWorkReports = driverReports.filter(r => r.direction === '퇴근');
            
            // 출근/퇴근 쌍이 맞지 않는 경우
            if (commuteReports.length !== offWorkReports.length) {
                const incompleteCount = Math.abs(commuteReports.length - offWorkReports.length);
                incompleteOperations.push({
                    driverName: driverName,
                    shuttleType: shuttleType,
                    incompleteCount: incompleteCount,
                    commuteCount: commuteReports.length,
                    offWorkCount: offWorkReports.length
                });
            }
        }
    }
    
    console.log('미완성 운행 결과:', incompleteOperations);
    return incompleteOperations;
}

function updateIncompleteOperationsAlert(incompleteOperations, dateStr) {
    const alertElement = document.getElementById('incompleteOperationsAlert');
    const textElement = document.getElementById('incompleteOperationsText');
    
    if (incompleteOperations.length > 0) {
        // 기사 수 계산 (중복 제거)
        const uniqueDrivers = new Set(incompleteOperations.map(op => op.driverName));
        const driverCount = uniqueDrivers.size;
        
        // 날짜 포맷팅 - 한국 시간대 기준
        const dateObj = new Date(dateStr + 'T00:00:00+09:00');
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        
        console.log('알림 표시 - 날짜:', dateStr, '월:', month, '일:', day);
        
        textElement.textContent = `${driverCount}명의 기사 ${month}월 ${day}일 미완성 운행 발생`;
        alertElement.classList.remove('hidden');
        
        // 전역 변수에 저장 (모달에서 사용)
        window.incompleteOperationsData = {
            operations: incompleteOperations,
            dateStr: dateStr
        };
    } else {
        alertElement.classList.add('hidden');
        window.incompleteOperationsData = null;
    }
}

function showIncompleteOperationsModal() {
    if (!window.incompleteOperationsData) {
        showNotification('미완성 운행 데이터가 없습니다.', 'error');
        return;
    }
    
    const { operations, dateStr } = window.incompleteOperationsData;
    const contentElement = document.getElementById('incompleteOperationsContent');
    
    // 기사별로 그룹화
    const driverGroups = {};
    for (const operation of operations) {
        if (!driverGroups[operation.driverName]) {
            driverGroups[operation.driverName] = [];
        }
        driverGroups[operation.driverName].push(operation);
    }
    
    // HTML 생성
    let html = '';
    for (const [driverName, driverOperations] of Object.entries(driverGroups)) {
        const operationTexts = driverOperations.map(op => 
            `${op.shuttleType} 미완성 운행 ${op.incompleteCount}건`
        );
        
        html += `
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-yellow-600 mr-3"></i>
                    <div>
                        <p class="font-medium text-gray-900">${driverName} 기사님</p>
                        <p class="text-sm text-gray-600">${operationTexts.join(', ')}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    contentElement.innerHTML = html;
    
    // 모달 표시
    const modal = document.getElementById('incompleteOperationsModal');
    modal.classList.remove('hidden');
}

function hideIncompleteOperationsModal() {
    const modal = document.getElementById('incompleteOperationsModal');
    modal.classList.add('hidden');
}

// ==================== 소속별 관리 기능 ====================

// 기사 데이터 로드
async function loadDriversData() {
    try {
        const { data: driversData, error: driversError } = await supabase
            .from('users')
            .select('name, phone, affiliation, role')
            .eq('role', 'driver');
        
        if (driversError) throw driversError;
        
        drivers = driversData || [];
        console.log('로드된 기사 수:', drivers.length);
        
    } catch (error) {
        console.error('기사 데이터 로드 실패:', error);
        showNotification('기사 데이터 로드에 실패했습니다.', 'error');
    }
}

// 소속별 데이터 업데이트
function updateAffiliationData() {
    try {
        // 소속별 통계 계산
        const affiliationStats = calculateAffiliationStats();
        
        // UI 업데이트
        updateAffiliationUI(affiliationStats);
        
    } catch (error) {
        console.error('소속별 데이터 업데이트 실패:', error);
        showNotification('소속별 데이터 업데이트에 실패했습니다.', 'error');
    }
}

// 소속별 통계 계산
function calculateAffiliationStats() {
    const affiliationGroups = {};
    
    // 기사별 소속 그룹화
    drivers.forEach(driver => {
        const affiliation = driver.affiliation || '미분류';
        if (!affiliationGroups[affiliation]) {
            affiliationGroups[affiliation] = {
                drivers: [],
                totalReports: 0,
                totalPassengers: 0,
                monthlyReports: {}
            };
        }
        affiliationGroups[affiliation].drivers.push(driver);
    });
    
    // 보고서별 통계 계산
    allReports.forEach(report => {
        const driver = drivers.find(d => d.name === report.driver_name);
        if (driver) {
            const affiliation = driver.affiliation || '미분류';
            if (affiliationGroups[affiliation]) {
                affiliationGroups[affiliation].totalReports++;
                affiliationGroups[affiliation].totalPassengers += report.passenger_count;
                
                // 월별 통계
                const reportDate = new Date(report.created_at);
                const monthKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
                
                if (!affiliationGroups[affiliation].monthlyReports[monthKey]) {
                    affiliationGroups[affiliation].monthlyReports[monthKey] = 0;
                }
                affiliationGroups[affiliation].monthlyReports[monthKey]++;
            }
        }
    });
    
    return affiliationGroups;
}

// 소속별 UI 업데이트
function updateAffiliationUI(affiliationStats) {
    // 요약 카드 업데이트
    const affiliations = Object.keys(affiliationStats);
    const totalDrivers = Object.values(affiliationStats).reduce((sum, group) => sum + group.drivers.length, 0);
    const totalReports = Object.values(affiliationStats).reduce((sum, group) => sum + group.totalReports, 0);
    const totalPassengers = Object.values(affiliationStats).reduce((sum, group) => sum + group.totalPassengers, 0);
    
    document.getElementById('totalAffiliations').textContent = affiliations.length;
    document.getElementById('totalDrivers').textContent = totalDrivers;
    
    // 소속별 기사 목록 업데이트
    updateAffiliationDriversList(affiliationStats);
}

// 소속별 기사 목록 업데이트 (카드 형식)
function updateAffiliationDriversList(affiliationStats) {
    const container = document.getElementById('affiliationDriversList');
    container.innerHTML = '';
    
    // 카드 그리드 컨테이너 생성
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    
    // 카드별 색상 배열
    const cardColors = [
        { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
        { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-700' },
        { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
        { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
        { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', badge: 'bg-pink-100 text-pink-700' },
        { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-700' },
        { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', badge: 'bg-teal-100 text-teal-700' },
        { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' }
    ];
    
    // 소속별 카드 생성 함수
    function createAffiliationCard(affiliation, stats, colorIndex) {
        const affiliationCard = document.createElement('div');
        
        // 특정 소속에 대한 색상 고정
        let colors;
        if (affiliation === '크루버스') {
            colors = { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' };
            console.log('크루버스 카드 색상 적용:', colors);
        } else if (affiliation === '골드타워') {
            colors = { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' };
            console.log('골드타워 카드 색상 적용:', colors);
        } else {
            colors = cardColors[colorIndex % cardColors.length];
            console.log(`${affiliation} 카드 색상 적용 (index: ${colorIndex}):`, colors);
        }
        
        affiliationCard.className = `${colors.bg} border ${colors.border} rounded-lg p-4 shadow-md hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-105`;
        console.log(`${affiliation} 카드 최종 클래스:`, affiliationCard.className);
        
        // 기사 이름 미리보기 (최대 3명까지)
        const driverPreview = stats.drivers.slice(0, 3).map(driver => driver.name).join(', ');
        const remainingCount = stats.drivers.length > 3 ? ` 외 ${stats.drivers.length - 3}명` : '';
        
        affiliationCard.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h5 class="font-semibold text-lg ${colors.text}">${affiliation}</h5>
                <span class="text-sm font-medium ${colors.badge} px-3 py-1 rounded-full">${stats.drivers.length}명</span>
            </div>
            <div class="text-sm text-gray-600">
                ${driverPreview}${remainingCount}
            </div>
        `;
        
        // 크루버스 카드에 인라인 스타일 추가 (CSS 우선순위 강화)
        if (affiliation === '크루버스') {
            affiliationCard.style.backgroundColor = '#fff7ed'; // orange-50
            affiliationCard.style.borderColor = '#fed7aa'; // orange-200
            console.log('크루버스 카드 인라인 스타일 적용됨');
        } else if (affiliation === '골드타워') {
            affiliationCard.style.backgroundColor = '#fefce8'; // yellow-50
            affiliationCard.style.borderColor = '#fde68a'; // yellow-200
            console.log('골드타워 카드 인라인 스타일 적용됨');
        }
        
        // 클릭 이벤트 추가
        affiliationCard.addEventListener('click', () => {
            showAffiliationDetailModal(affiliation, stats.drivers);
        });
        
        return affiliationCard;
    }
    
    // 소속별 카드를 순서대로 정렬 (크루버스가 첫 번째)
    const sortedAffiliations = Object.entries(affiliationStats).sort(([affiliationA], [affiliationB]) => {
        // 크루버스가 항상 첫 번째로 오도록 정렬
        if (affiliationA === '크루버스') return -1;
        if (affiliationB === '크루버스') return 1;
        // 나머지는 알파벳 순으로 정렬
        return affiliationA.localeCompare(affiliationB, 'ko');
    });
    
    console.log('정렬된 소속 목록:', sortedAffiliations.map(([affiliation]) => affiliation));
    
    // 정렬된 순서대로 카드 생성 및 추가
    sortedAffiliations.forEach(([affiliation, stats], index) => {
        // 크루버스와 골드타워는 특정 색상으로 고정, 나머지는 순차적으로 색상 적용
        let colorIndex;
        if (affiliation === '크루버스' || affiliation === '골드타워') {
            colorIndex = 0; // 특정 소속은 colorIndex를 0으로 설정 (색상 고정 로직에서 처리)
        } else {
            colorIndex = index; // 나머지는 순차적으로 색상 적용
        }
        const affiliationCard = createAffiliationCard(affiliation, stats, colorIndex);
        gridContainer.appendChild(affiliationCard);
    });
    
    container.appendChild(gridContainer);
}



// 소속별 상세 정보 모달 표시
function showAffiliationDetailModal(affiliation, drivers) {
    const modal = document.getElementById('affiliationDetailModal');
    const title = document.getElementById('affiliationDetailTitle');
    const content = document.getElementById('affiliationDetailContent');
    
    // 제목 설정
    title.textContent = `${affiliation} 기사 목록`;
    
    // 기사 목록을 이름 순으로 정렬 (크루버스 소속인 경우 특별 처리)
    const sortedDrivers = [...drivers].sort((a, b) => {
        // 크루버스 소속인 경우 크루버스 기사가 먼저 오도록 정렬
        if (affiliation === '크루버스') {
            // 크루버스 기사는 이름 순으로 정렬
            return a.name.localeCompare(b.name, 'ko');
        }
        // 다른 소속은 일반적인 이름 순 정렬
        return a.name.localeCompare(b.name, 'ko');
    });
    
    // 기사 목록 HTML 생성
    let driversHTML = '';
    sortedDrivers.forEach(driver => {
        driversHTML += `
            <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-medium text-gray-900">${driver.name}</p>
                        <p class="text-sm text-gray-600">${driver.phone}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="text-blue-600 hover:text-blue-800 p-1" onclick="editDriverAffiliation('${driver.name}', '${driver.phone}', '${affiliation}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = driversHTML;
    
    // 모달 표시
    modal.classList.remove('hidden');
}

// 소속별 상세 정보 모달 닫기
function hideAffiliationDetailModal() {
    const modal = document.getElementById('affiliationDetailModal');
    modal.classList.add('hidden');
}

// 기사 소속 수정 (기본 구현)
function editDriverAffiliation(driverName, driverPhone, currentAffiliation) {
    showNotification(`${driverName} 기사의 소속 수정 기능은 추후 구현 예정입니다.`, 'info');
}

// 소속 추가 모달 표시
function showAddAffiliationModal() {
    showNotification('소속 추가 기능은 추후 구현 예정입니다.', 'info');
}

// 소속별 보고서 내보내기
async function exportAffiliationReport() {
    try {
        showNotification('소속별 보고서 내보내기 기능은 추후 구현 예정입니다.', 'info');
    } catch (error) {
        console.error('소속별 보고서 내보내기 실패:', error);
        showNotification('보고서 내보내기에 실패했습니다.', 'error');
    }
}

// 5일치 피크 타임 계산 및 표시
async function calculateAndDisplayPeakTimes() {
    console.log('🕐 피크 타임 계산 시작...');
    
    // 피크타임 카드 요소 확인
    const peakTimeCard = document.getElementById('peakTimeDisplay');
    if (!peakTimeCard) {
        console.error('❌ peakTimeDisplay 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 로딩 상태 표시 (카드용)
    const peakTimeHour = document.getElementById('peakTimeHour');
    const peakTimeCount = document.getElementById('peakTimeCount');
    
    if (peakTimeHour) peakTimeHour.textContent = '계산중...';
    if (peakTimeCount) peakTimeCount.textContent = '로딩중';
    
    try {
        const peakTimes = await calculate5DayAveragePeakTimes();
        console.log('📊 피크 타임 계산 결과:', peakTimes);
        updatePeakTimeCard(peakTimes);
        console.log('✅ 피크타임 카드 업데이트 완료');
    } catch (error) {
        console.error('❌ 피크 타임 계산 실패:', error);
        if (peakTimeHour) peakTimeHour.textContent = '--:--';
        if (peakTimeCount) peakTimeCount.textContent = '오류 발생';
    }
}

// 5일치 평균 피크 타임 계산
async function calculate5DayAveragePeakTimes() {
    console.log('📅 selectedDate:', selectedDate);
    const today = new Date(selectedDate);
    const dates = [];
    
    // 오늘 포함 5일치 날짜 생성
    for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    console.log('📅 피크 타임 계산 대상 날짜들:', dates);
    
    // 각 날짜별 데이터 수집
    const allTimeData = {};
    
    for (const date of dates) {
        try {
            console.log(`🔍 ${date} 데이터 조회 시작...`);
            const { data: dayReports, error } = await supabase
                .from('shuttle_reports')
                .select('*')
                .gte('created_at', `${date}T00:00:00`)
                .lt('created_at', `${date}T23:59:59`);
                
            if (error) {
                console.error(`❌ ${date} 데이터 조회 실패:`, error);
                continue;
            }
            
            console.log(`📊 ${date} 데이터 조회 결과: ${dayReports?.length || 0}개`);
            
            // 시간대별 데이터 계산
            const timeSlots = {};
            for (let hour = 0; hour < 24; hour++) {
                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                timeSlots[timeSlot] = 0;
            }
            
            dayReports.forEach(report => {
                const reportTime = new Date(report.created_at);
                const hour = reportTime.getHours();
                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                timeSlots[timeSlot] += report.passenger_count || 0;
            });
            
            // 전체 데이터에 누적
            Object.keys(timeSlots).forEach(timeSlot => {
                if (!allTimeData[timeSlot]) {
                    allTimeData[timeSlot] = [];
                }
                allTimeData[timeSlot].push(timeSlots[timeSlot]);
            });
            
        } catch (error) {
            console.error(`${date} 데이터 처리 실패:`, error);
        }
    }
    
    // 5일 평균 계산
    const averageData = {};
    Object.keys(allTimeData).forEach(timeSlot => {
        const values = allTimeData[timeSlot];
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        averageData[timeSlot] = average;
    });
    
    // 상위 3개 시간대 찾기
    const sortedTimes = Object.entries(averageData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([time, count], index) => ({
            rank: index + 1,
            time: time,
            count: Math.round(count * 10) / 10, // 소수점 1자리로 반올림
            percentage: 0 // 백분율은 나중에 계산
        }));
    
    // 백분율 계산
    const totalCount = Object.values(averageData).reduce((a, b) => a + b, 0);
    if (totalCount > 0) {
        sortedTimes.forEach(item => {
            item.percentage = Math.round((item.count / totalCount) * 100 * 10) / 10;
        });
    }
    
    return sortedTimes;
}

// displayPeakTimeRanking 함수 제거됨 - updatePeakTimeCard 직접 사용

// 피크타임 통계카드 업데이트
function updatePeakTimeCard(peakTimes) {
    const peakTimeHour = document.getElementById('peakTimeHour');
    const peakTimeCount = document.getElementById('peakTimeCount');
    
    if (!peakTimeHour || !peakTimeCount) {
        console.error('❌ 피크타임 카드 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (!peakTimes || peakTimes.length === 0) {
        console.log('📊 피크 타임 데이터가 없음');
        peakTimeHour.textContent = '--:--';
        peakTimeCount.textContent = '데이터 없음';
        return;
    }
    
    // 1위 데이터 표시
    const topPeak = peakTimes[0];
    peakTimeHour.innerHTML = `👑 ${topPeak.time}`;
    peakTimeCount.textContent = `평균 ${topPeak.count}명 (${topPeak.percentage}%)`;
    
    console.log('✅ 피크타임 카드 업데이트 완료:', topPeak);
}

// ===== 피크타임 모달 관련 함수들 =====

// 피크타임 모달 열기
function openPeakTimeModal() {
    console.log('🕐 피크타임 모달 열기');
    const modal = document.getElementById('peakTimeModal');
    if (modal) {
        modal.classList.remove('hidden');
        // 모달이 열리면 상세 데이터 로드
        loadPeakTimeModalData();
    }
}

// 피크타임 모달 닫기
function closePeakTimeModal() {
    console.log('🕐 피크타임 모달 닫기');
    const modal = document.getElementById('peakTimeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 피크타임 모달 데이터 로드
async function loadPeakTimeModalData() {
    console.log('📊 피크타임 모달 데이터 로드 시작');
    
    try {
        // Top 5 피크타임 데이터 가져오기
        const peakTimes = await calculate5DayAveragePeakTimes();
        
        // Top 5 순위표 업데이트
        updatePeakTimeRankingList(peakTimes.slice(0, 5));
        
        // 일별 변화 차트 업데이트
        await updatePeakTimeTrendChart();
        
        // 시간대별 히트맵 업데이트
        updatePeakTimeHeatmap(peakTimes);
        
        // 통계 요약 업데이트
        updatePeakTimeStatistics(peakTimes);
        
        console.log('✅ 피크타임 모달 데이터 로드 완료');
    } catch (error) {
        console.error('❌ 피크타임 모달 데이터 로드 실패:', error);
        showErrorInModal();
    }
}

// Top 5 순위표 업데이트
function updatePeakTimeRankingList(peakTimes) {
    const container = document.getElementById('peakTimeRankingList');
    if (!container || !peakTimes || peakTimes.length === 0) {
        if (container) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500">데이터가 없습니다.</div>';
        }
        return;
    }
    
    const rankingHTML = peakTimes.map((peak, index) => {
        const rankEmoji = ['👑', '🥈', '🥉', '4️⃣', '5️⃣'][index];
        const bgColor = index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200';
        
        return `
            <div class="${bgColor} border rounded-lg p-4 flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="text-2xl">${rankEmoji}</div>
                    <div>
                        <div class="text-lg font-bold text-gray-900">${peak.time}</div>
                        <div class="text-sm text-gray-500">${index + 1}위</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-purple-600">${peak.count}명</div>
                    <div class="text-sm text-gray-500">${peak.percentage}%</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = rankingHTML;
    console.log('📊 Top 5 순위표 업데이트 완료');
}

// 일별 피크타임 변화 차트 업데이트
let peakTimeTrendChart = null; // 차트 인스턴스 저장용

async function updatePeakTimeTrendChart() {
    console.log('📈 일별 피크타임 변화 차트 업데이트 시작');
    
    const canvas = document.getElementById('peakTimeTrendChart');
    if (!canvas) {
        console.error('❌ 피크타임 트렌드 차트 캔버스를 찾을 수 없습니다');
        return;
    }
    
    try {
        // 기존 차트가 있다면 제거
        if (peakTimeTrendChart) {
            peakTimeTrendChart.destroy();
        }
        
        // 5일간 일별 피크타임 데이터 수집
        const dailyPeakData = await getDailyPeakTimeData();
        console.log('📊 일별 피크타임 데이터:', dailyPeakData);
        
        const ctx = canvas.getContext('2d');
        
        // Chart.js 라인 차트 생성
        peakTimeTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyPeakData.labels, // ['8/5', '8/6', '8/7', '8/8', '8/9']
                datasets: [{
                    label: '피크타임',
                    data: dailyPeakData.peakHours, // [14, 14, 15, 14, 14]
                    borderColor: 'rgb(147, 51, 234)', // 보라색
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(147, 51, 234)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }, {
                    label: '승객 수',
                    data: dailyPeakData.peakCounts, // [52, 58, 48, 62, 61]
                    borderColor: 'rgb(59, 130, 246)', // 파란색
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `피크타임: ${context.parsed.y}:00`;
                                } else {
                                    return `승객 수: ${context.parsed.y}명`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '날짜'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '시간 (시)'
                        },
                        min: 0,
                        max: 23,
                        ticks: {
                            callback: function(value) {
                                return value + ':00';
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '승객 수 (명)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        console.log('✅ 일별 피크타임 변화 차트 생성 완료');
        
    } catch (error) {
        console.error('❌ 피크타임 변화 차트 생성 실패:', error);
        
        // 오류 시 메시지 표시
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#EF4444';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('차트 데이터를 불러올 수 없습니다', canvas.width / 2, canvas.height / 2);
    }
}

// 5일간 일별 피크타임 데이터 수집
async function getDailyPeakTimeData() {
    console.log('📅 일별 피크타임 데이터 수집 시작');
    
    const today = new Date(selectedDate);
    const labels = [];
    const peakHours = [];
    const peakCounts = [];
    
    // 5일간 날짜 생성
    for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        // 라벨용 간단한 날짜 형식 (8/5)
        const month = date.getMonth() + 1;
        const day = date.getDate();
        labels.push(`${month}/${day}`);
        
        try {
            console.log(`🔍 ${dateString} 일별 데이터 조회...`);
            
            // 해당 날짜의 데이터 조회
            const { data: dayReports, error } = await supabase
                .from('shuttle_reports')
                .select('*')
                .gte('created_at', `${dateString}T00:00:00`)
                .lt('created_at', `${dateString}T23:59:59`);
                
            if (error) {
                console.error(`❌ ${dateString} 데이터 조회 실패:`, error);
                peakHours.push(null);
                peakCounts.push(0);
                continue;
            }
            
            console.log(`📊 ${dateString} 데이터: ${dayReports?.length || 0}개`);
            
            if (!dayReports || dayReports.length === 0) {
                peakHours.push(null);
                peakCounts.push(0);
                continue;
            }
            
            // 시간대별 승객 수 계산
            const timeSlots = {};
            for (let hour = 0; hour < 24; hour++) {
                timeSlots[hour] = 0;
            }
            
            dayReports.forEach(report => {
                const reportTime = new Date(report.created_at);
                const hour = reportTime.getHours();
                // 기존과 동일한 필드 사용
                timeSlots[hour] += report.passenger_count || 0;
            });
            
            // 가장 높은 승객 수를 가진 시간대 찾기
            let maxCount = 0;
            let peakHour = 0;
            
            Object.entries(timeSlots).forEach(([hour, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    peakHour = parseInt(hour);
                }
            });
            
            peakHours.push(peakHour);
            peakCounts.push(maxCount);
            
            console.log(`✅ ${dateString} 피크타임: ${peakHour}:00 (${maxCount}명)`);
            
        } catch (error) {
            console.error(`❌ ${dateString} 처리 중 오류:`, error);
            peakHours.push(null);
            peakCounts.push(0);
        }
    }
    
    console.log('📈 일별 피크타임 데이터 수집 완료:', { labels, peakHours, peakCounts });
    
    return {
        labels,
        peakHours,
        peakCounts
    };
}

// 시간대별 히트맵 업데이트 (실제 데이터 기반)
async function updatePeakTimeHeatmap(peakTimes) {
    console.log('🔥 정교한 시간대별 히트맵 업데이트 시작');
    const container = document.getElementById('peakTimeHeatmap');
    if (!container) return;
    
    try {
        // 5일간 시간대별 평균 승객 데이터 계산
        const hourlyData = await calculateHourlyAverageData();
        console.log('📊 시간대별 평균 데이터:', hourlyData);
        
        // 최대값 찾기 (색상 강도 계산용)
        const maxCount = Math.max(...Object.values(hourlyData));
        console.log('📈 최대 승객 수:', maxCount);
        
        // 24시간 히트맵 생성
        container.className = 'grid grid-cols-6 gap-2'; // 6x4 그리드로 변경
        
        let heatmapHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            const count = hourlyData[hour] || 0;
            const intensity = maxCount > 0 ? count / maxCount : 0;
            
            // 색상 계산 (보라색 그라디언트)
            const { bgColor, textColor } = getHeatmapColors(intensity);
            
            // 시간 표시 (12시간 형식도 함께)
            const hour24 = hour.toString().padStart(2, '0');
            const hour12 = hour === 0 ? '12AM' : hour <= 12 ? `${hour}${hour === 12 ? 'PM' : 'AM'}` : `${hour-12}PM`;
            
            heatmapHTML += `
                <div class="heatmap-cell h-16 rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-transform hover:scale-105 cursor-pointer border border-gray-200" 
                     style="background-color: ${bgColor}; color: ${textColor};"
                     data-hour="${hour}"
                     data-count="${count}"
                     title="${hour24}:00 - 평균 ${count.toFixed(1)}명">
                    <div class="font-bold">${hour24}:00</div>
                    <div class="text-[10px] opacity-75">${count.toFixed(1)}명</div>
                </div>
            `;
        }
        
        container.innerHTML = heatmapHTML;
        
        // 툴팁 이벤트 추가
        addHeatmapTooltips();
        
        console.log('✅ 정교한 히트맵 생성 완료');
        
    } catch (error) {
        console.error('❌ 히트맵 생성 실패:', error);
        container.innerHTML = `
            <div class="col-span-6 text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <div>히트맵 데이터를 불러올 수 없습니다</div>
            </div>
        `;
    }
}

// 5일간 시간대별 평균 승객 데이터 계산
async function calculateHourlyAverageData() {
    console.log('⏰ 시간대별 평균 데이터 계산 시작');
    
    const today = new Date(selectedDate);
    const hourlyTotals = {}; // {0: [day1Count, day2Count, ...], 1: [...], ...}
    
    // 24시간 초기화
    for (let hour = 0; hour < 24; hour++) {
        hourlyTotals[hour] = [];
    }
    
    // 5일간 데이터 수집
    for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
            console.log(`🔍 ${dateString} 시간대별 데이터 조회...`);
            
            const { data: dayReports, error } = await supabase
                .from('shuttle_reports')
                .select('*')
                .gte('created_at', `${dateString}T00:00:00`)
                .lt('created_at', `${dateString}T23:59:59`);
                
            if (error || !dayReports) {
                console.error(`❌ ${dateString} 데이터 조회 실패:`, error);
                // 데이터가 없는 경우 0으로 채우기
                for (let hour = 0; hour < 24; hour++) {
                    hourlyTotals[hour].push(0);
                }
                continue;
            }
            
            // 해당 날짜의 시간대별 승객 수 계산
            const dayHourlyData = {};
            for (let hour = 0; hour < 24; hour++) {
                dayHourlyData[hour] = 0;
            }
            
            dayReports.forEach(report => {
                const reportTime = new Date(report.created_at);
                const hour = reportTime.getHours();
                // 기존과 동일한 필드 사용
                dayHourlyData[hour] += report.passenger_count || 0;
            });
            
            // 시간대별 데이터를 배열에 추가
            for (let hour = 0; hour < 24; hour++) {
                hourlyTotals[hour].push(dayHourlyData[hour]);
            }
            
            console.log(`✅ ${dateString} 시간대별 데이터 수집 완료`);
            
        } catch (error) {
            console.error(`❌ ${dateString} 처리 중 오류:`, error);
            // 오류 발생시 0으로 채우기
            for (let hour = 0; hour < 24; hour++) {
                hourlyTotals[hour].push(0);
            }
        }
    }
    
    // 5일 평균 계산
    const hourlyAverages = {};
    for (let hour = 0; hour < 24; hour++) {
        const values = hourlyTotals[hour];
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        hourlyAverages[hour] = average;
    }
    
    console.log('📊 시간대별 5일 평균 계산 완료:', hourlyAverages);
    return hourlyAverages;
}

// 히트맵 색상 계산
function getHeatmapColors(intensity) {
    // intensity: 0.0 ~ 1.0
    
    if (intensity === 0) {
        return {
            bgColor: '#F3F4F6', // 회색
            textColor: '#6B7280'
        };
    }
    
    // 보라색 그라디언트 (연한 보라 → 진한 보라)
    const minR = 196, minG = 181, minB = 253; // #C4B5FD (보라 100)
    const maxR = 88, maxG = 28, maxB = 135;   // #581C87 (보라 900)
    
    const r = Math.round(minR + (maxR - minR) * intensity);
    const g = Math.round(minG + (maxG - minG) * intensity);
    const b = Math.round(minB + (maxB - minB) * intensity);
    
    const bgColor = `rgb(${r}, ${g}, ${b})`;
    const textColor = intensity > 0.5 ? '#FFFFFF' : '#374151';
    
    return { bgColor, textColor };
}

// 히트맵 툴팁 이벤트 추가
function addHeatmapTooltips() {
    const cells = document.querySelectorAll('.heatmap-cell');
    
    cells.forEach(cell => {
        cell.addEventListener('mouseenter', function() {
            const hour = this.dataset.hour;
            const count = parseFloat(this.dataset.count);
            
            // 간단한 툴팁 효과 (타이틀 속성 이미 설정됨)
            this.style.transform = 'scale(1.1)';
            this.style.zIndex = '10';
            this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        cell.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.zIndex = '';
            this.style.boxShadow = '';
        });
        
        // 클릭 이벤트 (향후 상세 정보 표시용)
        cell.addEventListener('click', function() {
            const hour = this.dataset.hour;
            const count = parseFloat(this.dataset.count);
            console.log(`🕐 ${hour}:00 시간대 클릭 - 평균 ${count.toFixed(1)}명`);
        });
    });
    
    console.log('🎯 히트맵 툴팁 이벤트 추가 완료');
}

// 통계 요약 업데이트 (임시 구현)
function updatePeakTimeStatistics(peakTimes) {
    console.log('📊 피크타임 통계 요약 업데이트');
    
    // 일관성 계산 (임시)
    document.getElementById('peakConsistency').textContent = '80%';
    
    // 평균 지속시간 (임시)
    document.getElementById('peakDuration').textContent = '45분';
    
    // 전주 대비 증감률 (임시)
    document.getElementById('peakGrowth').textContent = '+12%';
}

// 모달 에러 표시
function showErrorInModal() {
    const container = document.getElementById('peakTimeRankingList');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <div>데이터를 불러올 수 없습니다.</div>
            </div>
        `;
    }
}

// 피크타임 모달 이벤트 리스너 설정
function setupPeakTimeModalEvents() {
    console.log('🎯 피크타임 모달 이벤트 리스너 설정');
    
    // 피크타임 카드 클릭 이벤트
    const peakTimeCard = document.getElementById('peakTimeCard');
    if (peakTimeCard) {
        peakTimeCard.addEventListener('click', openPeakTimeModal);
        console.log('✅ 피크타임 카드 클릭 이벤트 등록 완료');
    }
    
    // 모달 닫기 버튼들 (X 버튼)
    const closeButton = document.getElementById('closePeakTimeModal');
    if (closeButton) {
        closeButton.addEventListener('click', closePeakTimeModal);
    }
    
    // 모달 닫기 버튼 (하단)
    const closeModalBtn = document.getElementById('closePeakTimeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closePeakTimeModal);
    }
    
    // 모달 배경 클릭시 닫기
    const modal = document.getElementById('peakTimeModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closePeakTimeModal();
            }
        });
    }
    
    console.log('🎯 피크타임 모달 이벤트 설정 완료');
} 