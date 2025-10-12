/**
 * 평면도 뷰어 - 전체화면 읽기 전용 평면도 표시
 * 편집 기능 없이 정보만 보여주는 고성능 뷰어
 */
export default class FloorplanViewer {
    constructor(floorPlanManager = null) {
        this.floorPlanManager = floorPlanManager;
        this.isOpen = false;
        this.currentSchoolId = null;
        this.zoomLevel = 1.0;
        this.deviceIconsVisible = true;
        this.apIconsVisible = false; // 무선AP 정보는 기본적으로 숨김
        this.isPanning = false;
        this.viewerContainer = null;
        
        // 뷰어 컨테이너 초기화
        this.initViewerContainer();
        
        // 장비별 색상 및 아이콘 정의 (연한 배경색 + 검은 글씨용)
        this.deviceColorMap = {
            '모니터': { color: '#B8E6B8', icon: 'fas fa-tv', name: '모니터' },
            '데스크톱': { color: '#B8CCFF', icon: 'fas fa-desktop', name: '데스크톱' },
            'TV': { color: '#FFB8B8', icon: 'fas fa-television', name: 'TV' },
            '프린터': { color: '#FFD6B8', icon: 'fas fa-print', name: '프린터' },
            '프로젝터': { color: '#E0B8FF', icon: 'fas fa-video', name: '프로젝터' },
            '전자칠판': { color: '#FFB8E0', icon: 'fas fa-chalkboard-teacher', name: '전자칠판' },
            '노트북': { color: '#B8E6FF', icon: 'fas fa-laptop', name: '노트북' },
            '키오스크': { color: '#E6B8E6', icon: 'fas fa-tablet-alt', name: '키오스크' },
            // 추가 가능한 장비들
            '태블릿': { color: '#FFE0B8', icon: 'fas fa-tablet-alt', name: '태블릿' },
            '스위치': { color: '#B8B8FF', icon: 'fas fa-network-wired', name: '스위치' },
            '서버': { color: '#E0B8B8', icon: 'fas fa-server', name: '서버' },
            '라우터': { color: '#D6B8FF', icon: 'fas fa-wifi', name: '라우터' },
            '스캐너': { color: '#FFECB8', icon: 'fas fa-file-image', name: '스캐너' },
            '카메라': { color: '#E6B8D6', icon: 'fas fa-camera', name: '카메라' },
            '스피커': { color: '#FFC8B8', icon: 'fas fa-volume-up', name: '스피커' },
            'UPS': { color: '#B8FFE0', icon: 'fas fa-battery-three-quarters', name: 'UPS' },
            '기타': { color: '#D0D0D0', icon: 'fas fa-microchip', name: '기타' }
        };
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
                 // 성능 최적화용
         this.renderedElements = [];
         this.isLoading = false;
         
         // 헤더 상태
         this.isHeaderCollapsed = false;
         
         this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 뷰어 닫기 버튼
        document.getElementById('closeViewerModal')?.addEventListener('click', () => {
            this.close();
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // 확대/축소 컨트롤
        document.getElementById('viewerZoomIn')?.addEventListener('click', () => {
            this.zoomIn();
        });
        
        document.getElementById('viewerZoomOut')?.addEventListener('click', () => {
            this.zoomOut();
        });
        
        document.getElementById('viewerZoomReset')?.addEventListener('click', () => {
            this.resetZoom();
        });
        
        // 장비 정보 토글
        document.getElementById('viewerDeviceToggle')?.addEventListener('click', () => {
            this.toggleDeviceIcons();
        });
        
                 document.getElementById('viewerApToggle')?.addEventListener('click', () => {
             this.toggleApIcons();
         });
         
         // 헤더 접기/펼치기 버튼 (지연 바인딩)
         this.bindHeaderToggle();
         
         // 간소화된 컨트롤 바인딩
         this.bindMiniControls();
         
         // 캔버스 팬 기능
         this.bindPanEvents();
    }
    
    bindPanEvents() {
        const wrapper = document.getElementById('viewerCanvasWrapper');
        if (!wrapper) return;
        
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let startX = 0;
        let startY = 0;
        
        // 마우스 드래그로 팬 (스크롤바 감지 제거)
        wrapper.addEventListener('mousedown', (e) => {
            console.log('🖱️ 마우스 다운 감지:', {
                좌표: { x: e.clientX, y: e.clientY },
                오프셋: { x: e.offsetX, y: e.offsetY },
                대상: e.target.tagName + (e.target.className ? '.' + e.target.className : ''),
                버튼: e.button,
                타겟: e.target === wrapper ? 'wrapper' : 'child'
            });
            
            // 마우스 우클릭은 제외
            if (e.button !== 0) {
                console.log('🔘 우클릭으로 드래그 제외');
                return;
            }
            
            // 버튼이나 특정 UI 요소 클릭은 제외
            if (e.target.closest('button, .viewer-btn, .legend-item')) {
                console.log('🎛️ UI 요소 클릭으로 드래그 제외');
                return;
            }
            
            // 드래그 시작
            isDragging = true;
            startX = lastX = e.clientX;
            startY = lastY = e.clientY;
            this.isDragging = true;
            
            wrapper.style.cursor = 'grabbing';
            wrapper.style.userSelect = 'none'; // 텍스트 선택 방지
            document.body.style.userSelect = 'none'; // 전체 페이지 텍스트 선택 방지
            
            console.log('✅ 드래그 시작 성공:', { startX, startY });
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        wrapper.addEventListener('mousemove', (e) => {
            if (!isDragging) {
                // 드래그 중이 아닐 때 커서 표시
                wrapper.style.cursor = 'grab';
                return;
            }
            
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            
                         // 적당한 드래그 속도
             const speedMultiplier = 2.0; // 속도 2배로 조정
            const moveX = deltaX * speedMultiplier;
            const moveY = deltaY * speedMultiplier;
            
            // 즉시 스크롤 업데이트 (requestAnimationFrame 사용)
            requestAnimationFrame(() => {
                const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;
                const maxScrollTop = wrapper.scrollHeight - wrapper.clientHeight;
                
                const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, wrapper.scrollLeft - moveX));
                const newScrollTop = Math.max(0, Math.min(maxScrollTop, wrapper.scrollTop - moveY));
                
                wrapper.scrollLeft = newScrollLeft;
                wrapper.scrollTop = newScrollTop;
                
                                 // 간단한 로그
                 if (Math.abs(moveX) > 1 || Math.abs(moveY) > 1) {
                     console.log(`🔄 드래그: (${deltaX},${deltaY}) → ×2 → 스크롤(${wrapper.scrollLeft}, ${wrapper.scrollTop})`);
                 }
            });
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        const stopDragging = (e) => {
            if (isDragging) {
                isDragging = false;
                this.isDragging = false;
                
                wrapper.style.cursor = 'grab';
                wrapper.style.userSelect = '';
                document.body.style.userSelect = '';
                
                // 드래그 거리가 매우 작으면 클릭으로 간주
                const dragDistance = Math.sqrt(
                    Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2)
                );
                
                console.log('🛑 드래그 종료:', {
                    거리: dragDistance,
                    시작: { x: startX, y: startY },
                    종료: { x: e.clientX, y: e.clientY },
                    판정: dragDistance < 5 ? '클릭' : '드래그'
                });
                
                if (dragDistance < 5) {
                    console.log('🖱️ 클릭으로 감지됨');
                } else {
                    console.log('🔄 드래그로 감지됨');
                }
            }
        };
        
        wrapper.addEventListener('mouseup', stopDragging);
        wrapper.addEventListener('mouseleave', stopDragging);
        document.addEventListener('mouseup', stopDragging); // 전역 mouseup 처리
        
        // 초기 커서 설정
        wrapper.style.cursor = 'grab';
        console.log('🎯 뷰어 드래그 시스템 초기화 완료');
        console.log('📐 뷰어 래퍼 정보:', {
            클라이언트크기: { width: wrapper.clientWidth, height: wrapper.clientHeight },
            스크롤위치: { left: wrapper.scrollLeft, top: wrapper.scrollTop },
            스크롤가능크기: { width: wrapper.scrollWidth, height: wrapper.scrollHeight },
            스크롤가능여부: { 
                horizontal: wrapper.scrollWidth > wrapper.clientWidth,
                vertical: wrapper.scrollHeight > wrapper.clientHeight
            },
            CSS스타일: {
                overflow: getComputedStyle(wrapper).overflow,
                overflowX: getComputedStyle(wrapper).overflowX,
                overflowY: getComputedStyle(wrapper).overflowY,
                position: getComputedStyle(wrapper).position
            }
        });
        
        // 터치 이벤트 지원 (모바일)
        this.bindTouchEvents(wrapper);
        
        // 키보드 단축키 (방향키로 스크롤)
        wrapper.addEventListener('keydown', (e) => {
            const scrollAmount = 50;
            switch (e.key) {
                case 'ArrowUp':
                    wrapper.scrollTop -= scrollAmount;
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    wrapper.scrollTop += scrollAmount;
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    wrapper.scrollLeft -= scrollAmount;
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    wrapper.scrollLeft += scrollAmount;
                    e.preventDefault();
                    break;
            }
        });
        
        // 포커스 가능하게 설정
        wrapper.tabIndex = 0;
    }
    
    /**
     * 터치 이벤트 바인딩 (모바일 지원)
     */
    bindTouchEvents(wrapper) {
        let isTouching = false;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let startTouchX = 0;
        let startTouchY = 0;
        
        wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                isTouching = true;
                startTouchX = lastTouchX = touch.clientX;
                startTouchY = lastTouchY = touch.clientY;
                this.isDragging = true;
                
                e.preventDefault();
            }
        }, { passive: false });
        
        wrapper.addEventListener('touchmove', (e) => {
            if (!isTouching || e.touches.length !== 1) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;
            
            wrapper.scrollLeft -= deltaX;
            wrapper.scrollTop -= deltaY;
            
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            
            e.preventDefault();
        }, { passive: false });
        
        const stopTouching = (e) => {
            if (isTouching) {
                isTouching = false;
                this.isDragging = false;
                
                // 터치 거리가 매우 작으면 탭으로 간주
                if (e.changedTouches && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const touchDistance = Math.sqrt(
                        Math.pow(touch.clientX - startTouchX, 2) + 
                        Math.pow(touch.clientY - startTouchY, 2)
                    );
                    
                    if (touchDistance < 10) {
                        console.log('👆 탭 감지');
                    }
                }
            }
        };
        
        wrapper.addEventListener('touchend', stopTouching);
        wrapper.addEventListener('touchcancel', stopTouching);
    }
    
    /**
     * 캔버스 정리
     */
    clearCanvas() {
        const canvas = document.getElementById('viewerCanvas');
        if (canvas) {
            canvas.innerHTML = '';
        }
        this.renderedElements = [];
        
        // 무선AP 상태 초기화
        this.apIconsVisible = false;
        const apToggle = document.getElementById('viewerApToggle');
        if (apToggle) {
            apToggle.classList.remove('active');
        }
        
        console.log('🧹 뷰어 캔버스 정리 완료');
    }
    
    /**
     * 뷰어 열기
     */
    async open(schoolId) {
        if (this.isLoading) return;
        
        this.currentSchoolId = schoolId;
        this.isLoading = true;
        
        // 모달 표시
        const modal = document.getElementById('floorplanViewerModal');
        const loading = document.getElementById('viewerLoading');
        
        modal.classList.add('show');
        loading.classList.remove('hidden');
        this.isOpen = true;
        
        // 이전 렌더링 정리
        this.clearCanvas();
        
        // 학교 정보 표시
        await this.updateSchoolInfo(schoolId);
        
        try {
            // 평면도 데이터 로드 (캐시 무시)
            console.log('🔄 뷰어에서 평면도 데이터 새로 로드...');
            const floorPlanData = await this.loadFloorPlanData(schoolId, true);
            console.log('📊 뷰어에서 로드된 데이터:', floorPlanData);
            
            // 뷰어 캔버스에 렌더링
            await this.renderFloorPlan(floorPlanData);
            
            // 교실 이름 보완 (DOM 렌더링 후)
            if (floorPlanData.rooms && floorPlanData.rooms.length > 0) {
                console.log('🔄 렌더링 후 교실 이름 보완 시작...');
                await this.enrichRoomNames(floorPlanData.rooms);
            }
            
            // 장비 정보 로드 (병렬 처리)
            if (this.deviceIconsVisible) {
                await this.loadAllDeviceIcons(floorPlanData);
                // 장비 아이콘 로드 후 범례 업데이트
                this.updateDeviceLegend();
            }
            
            loading.classList.add('hidden');
            
                         // 뷰어 열 때 스마트 위치로 스크롤 설정 (개체들이 있는 영역)
             setTimeout(() => {
                 this.setSmartInitialView();
                 // 헤더 토글 버튼 재바인딩
                 this.bindHeaderToggle();
             }, 100); // DOM 업데이트 완료 후 실행
            
            this.showNotification('평면도 뷰어가 열렸습니다.', 'success');
            
        } catch (error) {
            console.error('평면도 뷰어 로딩 실패:', error);
            loading.classList.add('hidden');
            this.showError('평면도를 불러오는데 실패했습니다.');
        }
        
        this.isLoading = false;
    }
    
    /**
     * 뷰어 닫기
     */
    close() {
        const modal = document.getElementById('floorplanViewerModal');
        modal.classList.remove('show');
        
        // 캔버스 초기화
        this.clearCanvas();
        this.resetZoom();
        
        this.isOpen = false;
        this.currentSchoolId = null;
        
        console.log('🚪 평면도 뷰어 닫힘');
    }
    
    /**
     * 학교 정보 업데이트
     */
    async updateSchoolInfo(schoolId) {
        try {
            // 학교 정보 조회 (기존 API 활용)
            const schools = this.floorPlanManager.floorPlanData?.schools || [];
            const school = schools.find(s => s.schoolId == schoolId);
            
            const schoolNameElement = document.getElementById('viewerSchoolName');
            const schoolInfoElement = document.getElementById('viewerSchoolInfo');
            
            if (school) {
                schoolNameElement.textContent = `${school.schoolName} 평면도`;
                schoolInfoElement.textContent = `${school.schoolName}의 상세 평면도를 확인하실 수 있습니다`;
            } else {
                schoolNameElement.textContent = '학교 평면도 보기';
                schoolInfoElement.textContent = '상세 정보가 포함된 읽기 전용 평면도입니다';
            }
        } catch (error) {
            console.error('학교 정보 로딩 실패:', error);
        }
    }
    
    /**
     * 평면도 데이터 로드
     */
    async loadFloorPlanData(schoolId, ignoreCache = false) {
        try {
            console.log('🔍 평면도 데이터 로드 시작:', schoolId, ignoreCache ? '(캐시 무시)' : '');
            
            // 캐시 무시를 위한 timestamp 추가
            const url = ignoreCache ? 
                `/floorplan/load?schoolId=${schoolId}&_t=${Date.now()}` : 
                `/floorplan/load?schoolId=${schoolId}`;
            
            const response = await fetch(url, {
                cache: ignoreCache ? 'no-cache' : 'default',
                headers: ignoreCache ? {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                } : {}
            });
            
            console.log('📡 평면도 로드 응답:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('📊 평면도 로드 결과:', result);
                console.log('📊 요소 개수:', result.elements ? result.elements.length : 0);
                
                if (result.success && result.elements && result.elements.length > 0) {
                    // 저장된 평면도가 있는 경우 - 요소 구조로 변환
                    console.log('✅ 저장된 평면도 발견, 변환 중...');
                    return this.convertElementsToFloorPlanData(result);
                } else {
                    console.log('💡 저장된 평면도가 없거나 비어있음, 기본 데이터 로드');
                    // 저장된 평면도가 없으면 기본 데이터 로드
                    return await this.loadDefaultFloorPlanData(schoolId);
                }
            } else {
                throw new Error(`평면도 데이터 조회 실패: ${response.status}`);
            }
        } catch (error) {
            console.error('평면도 데이터 로딩 오류:', error);
            throw error;
        }
    }
    
    /**
     * 저장된 요소들을 평면도 데이터 구조로 변환
     */
    convertElementsToFloorPlanData(result) {
        console.log('🔄 요소 데이터 변환 시작, 총 요소 수:', result.elements?.length || 0);
        
        const floorPlanData = {
            success: true,
            buildings: [],
            rooms: [],
            shapes: [],
            otherSpaces: [],
            wirelessAps: []
        };
        
        if (result.elements && Array.isArray(result.elements)) {
            result.elements.forEach((element, index) => {
                try {
                    console.log(`📦 요소 ${index + 1} 처리:`, {
                        type: element.elementType,
                        referenceId: element.referenceId,
                        x: element.xCoordinate,
                        y: element.yCoordinate
                    });
                    
                    // element_data가 JSON 문자열인 경우 파싱
                    let elementData = element.elementData;
                    if (typeof elementData === 'string') {
                        try {
                            elementData = JSON.parse(elementData);
                        } catch (parseError) {
                            console.warn('JSON 파싱 실패, 빈 객체로 처리:', parseError);
                            elementData = {};
                        }
                    }
                    
                    // elementData가 null이나 undefined인 경우 빈 객체로 초기화
                    if (!elementData || typeof elementData !== 'object') {
                        console.warn(`요소 ${index + 1}의 elementData가 유효하지 않음:`, elementData);
                        elementData = {};
                    }
                    
                    // 기본 좌표 정보 설정
                    const baseData = {
                        xCoordinate: element.xCoordinate,
                        yCoordinate: element.yCoordinate,
                        width: element.width || 120,
                        height: element.height || 105,
                        ...elementData // 추가 데이터 병합
                    };
                    
                    // 요소 타입별로 분류 (elementType 또는 type 필드 사용)
                    const elementType = element.elementType || element.type;
                    console.log(`🔍 요소 ${index + 1} 타입 확인:`, elementType, 'from:', element.elementType, '또는', element.type);
                    
                    switch (elementType) {
                        case 'building':
                            const building = {
                                buildingName: elementData.buildingName || elementData.name || '건물',
                                ...baseData
                            };
                            floorPlanData.buildings.push(building);
                            console.log('🏢 건물 추가:', building.buildingName);
                            break;
                            
                        case 'room':
                            // 안전한 데이터 추출
                            const classroomId = element.referenceId || elementData.classroomId;
                            let roomName = elementData.roomName || elementData.name;
                            
                            // roomName이 없고 classroomId가 있다면 임시 이름 생성
                            if (!roomName && classroomId) {
                                roomName = `교실 ${classroomId}`;
                                // 나중에 실제 교실 이름을 로드하기 위해 표시
                                console.log('🔄 교실 이름 미상, 나중에 로드 예정:', classroomId);
                            } else if (!roomName) {
                                roomName = '교실';
                            }
                            
                            const room = {
                                classroomId: classroomId,
                                roomName: roomName,
                                roomType: elementData.roomType || 'classroom',
                                ...baseData
                            };
                            floorPlanData.rooms.push(room);
                            console.log('🏫 교실 추가:', room.roomName, 'ID:', room.classroomId);
                            break;
                            
                        case 'shape':
                            const shape = {
                                shapeType: elementData.shapeType || 'rect',
                                color: elementData.color || '#000000',
                                thickness: elementData.thickness || 2,
                                ...baseData
                            };
                            floorPlanData.shapes.push(shape);
                            console.log('📐 도형 추가:', shape.shapeType);
                            break;
                            
                        case 'other_space':
                            const space = {
                                spaceType: elementData.spaceType || elementData.name || '기타공간',
                                ...baseData
                            };
                            floorPlanData.otherSpaces.push(space);
                            console.log('🏗️ 기타공간 추가:', space.spaceType);
                            break;
                            
                        case 'wireless_ap':
                            const ap = {
                                apName: elementData.apName || elementData.name || 'AP',
                                ...baseData
                            };
                            floorPlanData.wirelessAps.push(ap);
                            console.log('📶 무선AP 추가:', ap.apName);
                            break;
                            
                        default:
                            console.warn('알 수 없는 요소 타입:', element.elementType);
                    }
                } catch (parseError) {
                    console.error('요소 데이터 파싱 오류:', parseError, element);
                }
            });
        }
        
        console.log('🔄 변환 완료! 결과:', {
            buildings: floorPlanData.buildings.length,
            rooms: floorPlanData.rooms.length,
            shapes: floorPlanData.shapes.length,
            otherSpaces: floorPlanData.otherSpaces.length,
            wirelessAps: floorPlanData.wirelessAps.length
        });
        
        // 교실 이름 보완은 renderFloorPlan 후에 수행
        
        return floorPlanData;
    }
    
    /**
     * 교실 이름 보완 (비동기)
     */
    async enrichRoomNames(rooms) {
        const classroomIds = rooms
            .filter(room => room.classroomId && typeof room.classroomId === 'number')
            .map(room => room.classroomId);
        
        if (classroomIds.length === 0) {
            console.log('🔄 교실 이름 보완할 ID가 없습니다.');
            return;
        }
        
        try {
            console.log('🔄 교실 이름 보완 중...', classroomIds);
            
            // 배치 API로 교실 정보 조회 (기존 API 활용)
            const response = await fetch(`/floorplan/api/classrooms/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ classroomIds: classroomIds })
            });
            
            console.log('📡 교실 정보 API 응답:', response.status, response.statusText);
            
            if (response.ok) {
                const classroomsData = await response.json();
                console.log('📊 수신된 교실 데이터:', classroomsData);
                
                // 교실 이름 업데이트
                rooms.forEach(room => {
                    if (room.classroomId && classroomsData[room.classroomId]) {
                        const classroomInfo = classroomsData[room.classroomId];
                        const oldName = room.roomName;
                        room.roomName = classroomInfo.roomName || room.roomName;
                        console.log('✅ 교실 이름 업데이트:', room.classroomId, oldName, '->', room.roomName);
                        
                        // DOM 요소도 함께 업데이트 (장비 아이콘 보존)
                        const roomElement = document.querySelector(`#viewerCanvas .room[data-classroom-id="${room.classroomId}"]`);
                        if (roomElement) {
                            // .room-name 요소를 찾아서 업데이트
                            const nameElement = roomElement.querySelector('.room-name');
                            if (nameElement) {
                                nameElement.textContent = room.roomName;
                                console.log('🎨 DOM 교실 이름 업데이트:', room.classroomId, room.roomName);
                            } else {
                                console.warn('⚠️ .room-name 요소를 찾을 수 없음:', room.classroomId);
                            }
                        }
                    } else {
                        console.log('⚠️ 교실 정보 없음:', room.classroomId);
                    }
                });
            } else {
                console.error('❌ 교실 정보 API 요청 실패:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('API 오류 내용:', errorText);
            }
        } catch (error) {
            console.error('❌ 교실 이름 보완 실패:', error);
            console.error('API 호출 스택:', error.stack);
        }
    }
    
    /**
     * 기본 평면도 데이터 로드
     */
    async loadDefaultFloorPlanData(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/school/${schoolId}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    buildings: data.buildings || [],
                    rooms: data.rooms || [],
                    shapes: [],
                    otherSpaces: [],
                    wirelessAps: data.wirelessAps || []
                };
            } else {
                throw new Error('기본 데이터 조회 실패');
            }
        } catch (error) {
            console.error('기본 평면도 데이터 로딩 오류:', error);
            throw error;
        }
    }
    
    /**
     * 평면도 렌더링 (정적 버전)
     */
    async renderFloorPlan(floorPlanData) {
        const canvas = document.getElementById('viewerCanvas');
        if (!canvas) {
            throw new Error('뷰어 캔버스를 찾을 수 없습니다');
        }
        
        // 기존 요소 제거
        this.clearCanvas();
        
        console.log('🎨 뷰어 평면도 렌더링 시작');
        console.log('📊 렌더링할 데이터:', {
            buildings: floorPlanData.buildings?.length || 0,
            rooms: floorPlanData.rooms?.length || 0,
            shapes: floorPlanData.shapes?.length || 0,
            otherSpaces: floorPlanData.otherSpaces?.length || 0,
            wirelessAps: floorPlanData.wirelessAps?.length || 0
        });
        
        // DocumentFragment를 사용한 성능 최적화
        const fragment = document.createDocumentFragment();
        let totalRendered = 0;
        
        // 건물 렌더링
        if (floorPlanData.buildings && floorPlanData.buildings.length > 0) {
            console.log('🏢 건물 렌더링 시작:', floorPlanData.buildings.length + '개');
            floorPlanData.buildings.forEach((building, index) => {
                try {
                    if (!building) {
                        console.warn(`⚠️ 건물 ${index + 1} 데이터가 null/undefined`);
                        return;
                    }
                    const element = this.renderStaticBuilding(building);
                    fragment.appendChild(element);
                    totalRendered++;
                    console.log(`✅ 건물 ${index + 1} 렌더링:`, building.buildingName || '이름없음');
                } catch (error) {
                    console.error(`❌ 건물 ${index + 1} 렌더링 실패:`, error, building);
                }
            });
        }
        
        // 교실 렌더링
        if (floorPlanData.rooms && floorPlanData.rooms.length > 0) {
            console.log('🏫 교실 렌더링 시작:', floorPlanData.rooms.length + '개');
            floorPlanData.rooms.forEach((room, index) => {
                try {
                    if (!room) {
                        console.warn(`⚠️ 교실 ${index + 1} 데이터가 null/undefined`);
                        return;
                    }
                    const element = this.renderStaticRoom(room);
                    fragment.appendChild(element);
                    totalRendered++;
                    console.log(`✅ 교실 ${index + 1} 렌더링:`, room.roomName || '이름없음');
                } catch (error) {
                    console.error(`❌ 교실 ${index + 1} 렌더링 실패:`, error, room);
                }
            });
        }
        
        // 도형 렌더링
        if (floorPlanData.shapes && floorPlanData.shapes.length > 0) {
            console.log('📐 도형 렌더링 시작:', floorPlanData.shapes.length + '개');
            floorPlanData.shapes.forEach((shape, index) => {
                try {
                    const element = this.renderStaticShape(shape);
                    fragment.appendChild(element);
                    totalRendered++;
                    console.log(`✅ 도형 ${index + 1} 렌더링:`, shape.shapeType);
                } catch (error) {
                    console.error(`❌ 도형 ${index + 1} 렌더링 실패:`, error, shape);
                }
            });
        }
        
        // 기타공간 렌더링
        if (floorPlanData.otherSpaces && floorPlanData.otherSpaces.length > 0) {
            console.log('🏗️ 기타공간 렌더링 시작:', floorPlanData.otherSpaces.length + '개');
            floorPlanData.otherSpaces.forEach((space, index) => {
                try {
                    const element = this.renderStaticOtherSpace(space);
                    fragment.appendChild(element);
                    totalRendered++;
                    console.log(`✅ 기타공간 ${index + 1} 렌더링:`, space.spaceType);
                } catch (error) {
                    console.error(`❌ 기타공간 ${index + 1} 렌더링 실패:`, error, space);
                }
            });
        }
        
        // 무선AP 렌더링
        if (floorPlanData.wirelessAps && floorPlanData.wirelessAps.length > 0) {
            console.log('📶 무선AP 렌더링 시작:', floorPlanData.wirelessAps.length + '개');
            floorPlanData.wirelessAps.forEach((ap, index) => {
                try {
                    const element = this.renderStaticWirelessAp(ap);
                    fragment.appendChild(element);
                    totalRendered++;
                    console.log(`✅ 무선AP ${index + 1} 렌더링:`, ap.apName);
                } catch (error) {
                    console.error(`❌ 무선AP ${index + 1} 렌더링 실패:`, error, ap);
                }
            });
        }
        
        console.log(`📦 Fragment에 총 ${totalRendered}개 요소 준비 완료`);
        
        // 한번에 DOM에 추가
        canvas.appendChild(fragment);
        
        console.log(`🎨 DOM 추가 완료! 캔버스에 총 ${canvas.children.length}개 요소`);
        
        // 렌더링 완료 후 확인
        setTimeout(() => {
            const actualElements = canvas.children.length;
            console.log(`📊 렌더링 최종 확인: ${actualElements}개 요소가 실제로 표시됨`);
        }, 100);
        
        console.log(`✅ 뷰어 렌더링 완료: ${this.renderedElements.length}개 요소`);
    }
    
    /**
     * 정적 건물 렌더링
     */
    renderStaticBuilding(building) {
        const element = document.createElement('div');
        element.className = 'building draggable';
        element.style.cssText = `
            position: absolute;
            left: ${building.xCoordinate}px;
            top: ${building.yCoordinate}px;
            width: ${building.width}px;
            height: ${building.height}px;
            background: transparent;
            border: 2px solid #000;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
            pointer-events: none;
        `;
        
        element.textContent = building.buildingName || building.name || '건물';
        this.renderedElements.push(element);
        
        return element;
    }
    
    /**
     * 정적 교실 렌더링
     */
    renderStaticRoom(room) {
        if (!room) {
            console.error('renderStaticRoom: room 데이터가 null/undefined');
            throw new Error('교실 데이터가 없습니다');
        }

        const element = document.createElement('div');
        element.className = 'room draggable';
        // 뷰어에서는 data-classroom-id 속성 사용 (장비 아이콘 로딩용)
        element.dataset.classroomId = room.classroomId || room.id || '';
        
        // 기본값 설정
        const xCoordinate = room.xCoordinate || 0;
        const yCoordinate = room.yCoordinate || 0;
        const width = room.width || 120;
        const height = room.height || 105;
        
        element.style.cssText = `
            position: absolute;
            left: ${xCoordinate}px;
            top: ${yCoordinate}px;
            width: ${width}px;
            height: ${height}px;
            background: transparent;
            border: 2px solid #000;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            padding: 0.2rem;
            pointer-events: none;
            overflow: visible;
            box-sizing: border-box;
        `;
        
        // 교실명 표시 (임시 이름 처리)
        const nameElement = document.createElement('div');
        nameElement.className = 'room-name';
        
        // 실제 교실명이 있으면 사용, 없으면 임시 이름
        let displayName = room.roomName || room.name;
        if (!displayName && room.classroomId) {
            displayName = `교실 ${room.classroomId}`;
        } else if (!displayName) {
            displayName = '교실';
        }
        
        nameElement.textContent = displayName;
        nameElement.style.cssText = `
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            font-weight: bold;
            pointer-events: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 90%;
        `;
        
        element.appendChild(nameElement);
        this.renderedElements.push(element);
        
        return element;
    }
    
    /**
     * 정적 도형 렌더링
     */
    renderStaticShape(shape) {
        const element = document.createElement('div');
        element.className = `shape shape-${shape.shapeType}`;
        
        element.style.cssText = `
            position: absolute;
            left: ${shape.xCoordinate}px;
            top: ${shape.yCoordinate}px;
            width: ${shape.width}px;
            height: ${shape.height}px;
            pointer-events: none;
        `;
        
        // 도형 타입별 스타일 적용
        this.applyShapeStyle(element, shape);
        this.renderedElements.push(element);
        
        return element;
    }
    
    /**
     * 정적 기타공간 렌더링
     */
    renderStaticOtherSpace(space) {
        const element = document.createElement('div');
        element.className = 'room draggable';
        element.dataset.type = 'other-space';
        
        element.style.cssText = `
            position: absolute;
            left: ${space.xCoordinate}px;
            top: ${space.yCoordinate}px;
            width: ${space.width}px;
            height: ${space.height}px;
            background: transparent;
            border: 2px solid #000;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
            color: #333;
            font-size: 0.8rem;
            pointer-events: none;
        `;
        
        element.textContent = space.spaceType || space.name || '기타공간';
        this.renderedElements.push(element);
        
        return element;
    }
    
    /**
     * 정적 무선AP 렌더링
     */
    renderStaticWirelessAp(ap) {
        const element = document.createElement('div');
        element.className = 'wireless-ap draggable';
        element.dataset.type = 'wireless-ap';
        
        element.style.cssText = `
            position: absolute;
            left: ${ap.xCoordinate}px;
            top: ${ap.yCoordinate}px;
            width: ${ap.width || 40}px;
            height: ${ap.height || 40}px;
            background: #4CAF50;
            border: 2px solid #45a049;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.7rem;
            font-weight: bold;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        
        // AP 아이콘 또는 텍스트
        const iconHtml = `
            <div style="text-align: center; line-height: 1;">
                <i class="fas fa-wifi" style="font-size: 12px; display: block; margin-bottom: 2px;"></i>
                <span style="font-size: 8px;">${(ap.apName || ap.name || 'AP').substring(0, 3)}</span>
            </div>
        `;
        
        element.innerHTML = iconHtml;
        this.renderedElements.push(element);
        
        return element;
    }
    
    /**
     * 도형 스타일 적용
     */
    applyShapeStyle(element, shape) {
        const color = shape.color || '#000000';
        const thickness = shape.thickness || 2;
        
        switch (shape.shapeType) {
            case 'line':
            case 'arrow':
                element.style.backgroundColor = color;
                element.style.height = thickness + 'px';
                break;
            case 'dashed':
                element.style.border = `${thickness}px dashed ${color}`;
                element.style.backgroundColor = 'transparent';
                break;
            case 'circle':
                element.style.border = `${thickness}px solid ${color}`;
                element.style.borderRadius = '50%';
                element.style.backgroundColor = 'transparent';
                break;
            case 'rect':
                element.style.border = `${thickness}px solid ${color}`;
                element.style.backgroundColor = 'transparent';
                break;
            default:
                element.style.border = `${thickness}px solid ${color}`;
                element.style.backgroundColor = 'transparent';
        }
    }
    
    /**
     * 모든 장비 아이콘 로드 (뷰어용 최적화)
     */
    async loadAllDeviceIcons(floorPlanData) {
        if (!this.deviceIconsVisible || !floorPlanData.rooms) return;
        
        console.log('🔧 뷰어 장비 아이콘 로딩 시작...');
        
        try {
            // 유효한 교실 ID 수집
            const classroomIds = floorPlanData.rooms
                .map(room => room.classroomId || room.id)
                .filter(id => id && !id.toString().startsWith('temp_') && id !== 'new');
            
            if (classroomIds.length === 0) {
                console.log('📭 유효한 교실이 없습니다.');
                return;
            }
            
            // 배치 API로 장비 정보 로드
            const deviceData = await this.loadDevicesBatch(classroomIds);
            
            // 각 교실에 장비 아이콘 추가
            Object.entries(deviceData).forEach(([classroomId, devices]) => {
                // 정확한 선택자 사용
                const roomElement = document.querySelector(`#viewerCanvas .room[data-classroom-id="${classroomId}"]`);
                console.log(`🔍 교실 ${classroomId} 요소 검색:`, roomElement ? '찾음' : '없음');
                
                if (roomElement && Object.keys(devices).length > 0) {
                    console.log(`🎨 교실 ${classroomId}에 장비 아이콘 추가:`, devices);
                    this.addDeviceIconsToRoom(roomElement, devices);
                }
            });
            
            console.log(`✅ ${Object.keys(deviceData).length}개 교실의 장비 아이콘 로딩 완료`);
            
        } catch (error) {
            console.error('장비 아이콘 로딩 실패:', error);
        }
    }
    
    /**
     * 배치 장비 데이터 로드
     */
    async loadDevicesBatch(classroomIds) {
        try {
            const response = await fetch('/floorplan/api/classrooms/devices/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classroomIds })
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('배치 API 호출 실패');
            }
        } catch (error) {
            console.warn('배치 API 실패, 개별 호출로 처리:', error);
            return await this.loadDevicesIndividually(classroomIds.slice(0, 20)); // 제한
        }
    }
    
    /**
     * 개별 장비 데이터 로드
     */
    async loadDevicesIndividually(classroomIds) {
        const deviceData = {};
        const promises = classroomIds.map(async (classroomId) => {
            try {
                const response = await fetch(`/floorplan/api/classroom/${classroomId}/devices`);
                if (response.ok) {
                    deviceData[classroomId] = await response.json();
                }
            } catch (error) {
                console.error(`교실 ${classroomId} 장비 정보 로딩 실패:`, error);
            }
        });
        
        await Promise.all(promises);
        return deviceData;
    }
    
    /**
     * 교실에 장비 아이콘 추가 (뷰어용 간소화)
     */
    addDeviceIconsToRoom(roomElement, deviceCounts) {
        // 기존 장비 아이콘 제거
        const existingDevices = roomElement.querySelector('.room-devices');
        if (existingDevices) {
            existingDevices.remove();
        }
        
        // 장비 종류별로 필터링 (개수가 0보다 큰 것만)
        const validDevices = Object.entries(deviceCounts).filter(([type, count]) => count > 0);
        const deviceCount = validDevices.length;
        
        if (deviceCount === 0) return; // 장비가 없으면 아무것도 표시하지 않음
        
        // 교실 크기 계산 (사용 가능한 너비)
        const roomWidth = parseFloat(roomElement.style.width) || 120;
        const availableWidth = roomWidth - 8; // 좌우 여백 4px씩
        
        // 적응형 크기 계산 시스템
        const sizeConfig = this.calculateOptimalSizing(validDevices, availableWidth, deviceCount);
        
        const devicesContainer = document.createElement('div');
        devicesContainer.className = 'room-devices';
        devicesContainer.style.cssText = `
            position: absolute;
            bottom: 3px;
            left: 4px;
            right: 4px;
            height: ${sizeConfig.containerHeight}px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            z-index: 10;
            pointer-events: none;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 6px;
            padding: 2px;
            border: 1px solid rgba(0, 0, 0, 0.15);
            box-sizing: border-box;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        `;
        
        // 행별로 장비 배치
        sizeConfig.rows.forEach((rowDevices, rowIndex) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                gap: ${sizeConfig.gap}px;
                flex: 1;
                overflow: hidden;
            `;
            
            rowDevices.forEach(([type, count]) => {
                const deviceBadge = this.createAdaptiveBadge(type, count, sizeConfig);
                row.appendChild(deviceBadge);
            });
            
            devicesContainer.appendChild(row);
        });
        
        roomElement.appendChild(devicesContainer);
    }
    
    /**
     * 최적 크기 계산 (절대 짤림 방지)
     */
    calculateOptimalSizing(validDevices, availableWidth, deviceCount) {
        // 기본 설정값들
        const sizes = [
            { height: 18, fontSize: 10, gap: 2, rows: 1 },  // 1줄 큰 크기
            { height: 16, fontSize: 9, gap: 2, rows: 1 },   // 1줄 중간 크기
            { height: 14, fontSize: 8, gap: 1, rows: 1 },   // 1줄 작은 크기
            { height: 16, fontSize: 9, gap: 2, rows: 2 },   // 2줄 중간 크기
            { height: 14, fontSize: 8, gap: 1, rows: 2 },   // 2줄 작은 크기
            { height: 12, fontSize: 7, gap: 1, rows: 2 },   // 2줄 최소 크기
            { height: 11, fontSize: 6, gap: 1, rows: 3 },   // 3줄 최소 크기
        ];
        
        // 각 크기별로 테스트해서 맞는 것 찾기
        for (const size of sizes) {
            const testResult = this.testSizing(validDevices, availableWidth, size);
            if (testResult.fits) {
                return {
                    ...size,
                    containerHeight: size.height * size.rows + 4, // 패딩 포함
                    rows: testResult.rows
                };
            }
        }
        
        // 마지막 수단: 최소 크기로 강제 적용
        const fallbackSize = sizes[sizes.length - 1];
        return {
            ...fallbackSize,
            containerHeight: fallbackSize.height * fallbackSize.rows + 4,
            rows: this.distributeToRows(validDevices, fallbackSize.rows)
        };
    }
    
    /**
     * 크기 테스트 (해당 크기로 모든 장비가 들어가는지 확인) - 유동적 크기 반영
     */
    testSizing(validDevices, availableWidth, size) {
        const rowsData = this.distributeToRows(validDevices, size.rows);
        
        // 각 행의 너비 계산 (새로운 유동적 계산 방식)
        for (const rowDevices of rowsData) {
            let rowWidth = 0;
            
            for (const [type, count] of rowDevices) {
                const text = `${type} ${count}`;
                const padding = 10; // 패딩 증가
                const baseWidth = text.length * (size.fontSize * 0.7); // 더 여유로운 계산
                const badgeWidth = Math.max(baseWidth + padding, 35); // 최소 너비 증가
                rowWidth += badgeWidth + size.gap;
            }
            
            rowWidth -= size.gap; // 마지막 gap 제거
            
            if (rowWidth > availableWidth) {
                return { fits: false };
            }
        }
        
        return { fits: true, rows: rowsData };
    }
    
    /**
     * 장비를 행별로 분배
     */
    distributeToRows(validDevices, numRows) {
        if (numRows === 1) {
            return [validDevices];
        }
        
        const rows = [];
        const itemsPerRow = Math.ceil(validDevices.length / numRows);
        
        for (let i = 0; i < numRows; i++) {
            const startIndex = i * itemsPerRow;
            const endIndex = Math.min(startIndex + itemsPerRow, validDevices.length);
            
            if (startIndex < validDevices.length) {
                rows.push(validDevices.slice(startIndex, endIndex));
            }
        }
        
        return rows;
    }
    
    /**
     * 적응형 뱃지 생성 (유동적 크기 + 연한 배경)
     */
    createAdaptiveBadge(type, count, sizeConfig) {
        // 장비별 색상 정보 가져오기
        const deviceInfo = this.deviceColorMap[type] || this.deviceColorMap['기타'];
        
        const deviceBadge = document.createElement('div');
        deviceBadge.className = 'device-badge';
        deviceBadge.dataset.deviceType = type;
        
        // 유동적 텍스트 너비 계산 (더 여유롭게)
        const text = `${type} ${count}`;
        const padding = 10; // 패딩 증가
        const baseWidth = text.length * (sizeConfig.fontSize * 0.7); // 더 여유로운 계산
        const badgeWidth = Math.max(baseWidth + padding, 35); // 최소 너비 증가
        
        deviceBadge.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: ${sizeConfig.height}px;
            width: ${badgeWidth}px;
            background: ${deviceInfo.color};
            color: #333333;
            border-radius: 4px;
            font-size: ${sizeConfig.fontSize}px;
            font-weight: 600;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            border: 1px solid rgba(0,0,0,0.15);
            flex-shrink: 0;
            overflow: visible;
            padding: 0 5px;
            box-sizing: border-box;
        `;
        
        deviceBadge.textContent = text;
        
        // 툴팁
        deviceBadge.title = `${deviceInfo.name}: ${count}개`;
        
        return deviceBadge;
    }
    
    /**
     * 장비 이름 그대로 사용 (DB 명칭 유지)
     */
    getShortDeviceName(type) {
        // DB 명칭 그대로 사용
        return type;
    }
    
    /**
     * 장비 아이콘 정보 가져오기
     */
    getDeviceIcon(type) {
        const iconMap = {
            '모니터': 'fas fa-desktop',
            '노트북': 'fas fa-laptop',
            '태블릿': 'fas fa-tablet-alt',
            '프린터': 'fas fa-print',
            '스피커': 'fas fa-volume-up',
            '프로젝터': 'fas fa-video',
            'default': 'fas fa-microchip'
        };
        
        return iconMap[type] || iconMap.default;
    }
    
    /**
     * 확대 (화면 중심 기준)
     */
    zoomIn() {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3.0);
        this.applyZoomWithCenter(oldZoom);
    }
    
    /**
     * 축소 (화면 중심 기준)
     */
    zoomOut() {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.3);
        this.applyZoomWithCenter(oldZoom);
    }
    
    /**
     * 줌 리셋
     */
    resetZoom() {
        this.zoomLevel = 1.0;
        this.applyZoom();
        this.centerView(); // 중앙으로 이동
    }
    
         /**
      * 줌 적용
      */
     applyZoom() {
         const canvas = document.getElementById('viewerCanvas');
         const zoomDisplay = document.getElementById('viewerZoomLevel');
         
         if (canvas) {
             canvas.style.transform = `scale(${this.zoomLevel})`;
         }
         
         if (zoomDisplay) {
             zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
         }
         
         // 간소화된 컨트롤의 줌 레벨도 업데이트
         this.updateMiniZoomDisplay();
     }
    
         /**
      * 화면 중심 기준으로 줌 적용 (간소화)
      */
     applyZoomWithCenter(oldZoom) {
         const wrapper = document.getElementById('viewerCanvasWrapper');
         const canvas = document.getElementById('viewerCanvas');
         
         if (!wrapper || !canvas) {
             this.applyZoom();
             return;
         }
         
         // 현재 뷰포트의 중심점 계산
         const viewportCenterX = wrapper.scrollLeft + wrapper.clientWidth / 2;
         const viewportCenterY = wrapper.scrollTop + wrapper.clientHeight / 2;
         
         // 줌 적용
         this.applyZoom();
         
         // 줌 변화 비율
         const zoomRatio = this.zoomLevel / oldZoom;
         
         // 새로운 중심점 계산 및 스크롤 조정
         const newCenterX = viewportCenterX * zoomRatio;
         const newCenterY = viewportCenterY * zoomRatio;
         
         // 뷰포트를 중심에 맞춰 조정
         wrapper.scrollLeft = Math.max(0, newCenterX - wrapper.clientWidth / 2);
         wrapper.scrollTop = Math.max(0, newCenterY - wrapper.clientHeight / 2);
     }
    
         /**
      * 뷰를 중앙으로 이동
      */
     centerView() {
         const wrapper = document.getElementById('viewerCanvasWrapper');
         const canvas = document.getElementById('viewerCanvas');
         
         if (!wrapper || !canvas) return;
         
         // 캔버스의 스케일된 크기와 뷰포트 크기
         const scaledWidth = 4000 * this.zoomLevel;
         const scaledHeight = 2500 * this.zoomLevel;
         
         // 중앙 위치 계산 (뷰포트를 캔버스 중앙에 배치)
         const centerX = Math.max(0, (scaledWidth - wrapper.clientWidth) / 2);
         const centerY = Math.max(0, (scaledHeight - wrapper.clientHeight) / 2);
         
         wrapper.scrollLeft = centerX;
         wrapper.scrollTop = centerY;
     }
     
     /**
      * 스마트 초기 뷰 설정 - 개체들이 있는 영역으로 자동 이동
      */
     setSmartInitialView() {
         const wrapper = document.getElementById('viewerCanvasWrapper');
         const canvas = document.getElementById('viewerCanvas');
         
         if (!wrapper || !canvas) {
             console.log('📍 래퍼나 캔버스가 없어 기본 중앙으로 이동');
             this.centerView();
             return;
         }
         
         // 렌더링된 모든 개체들의 경계 계산
         const bounds = this.calculateContentBounds();
         
         if (!bounds) {
             console.log('📍 개체가 없어 기본 중앙으로 이동');
             this.centerView();
             return;
         }
         
         console.log('📍 개체 경계 감지:', bounds);
         
         // 경계에 여백 추가
         const padding = 100;
         const contentCenterX = (bounds.left + bounds.right) / 2;
         const contentCenterY = (bounds.top + bounds.bottom) / 2;
         
         // 줌 레벨 고려한 좌표 계산
         const scaledCenterX = contentCenterX * this.zoomLevel;
         const scaledCenterY = contentCenterY * this.zoomLevel;
         
         // 뷰포트를 컨텐츠 중심으로 이동
         const scrollLeft = Math.max(0, scaledCenterX - wrapper.clientWidth / 2);
         const scrollTop = Math.max(0, scaledCenterY - wrapper.clientHeight / 2);
         
         wrapper.scrollLeft = scrollLeft;
         wrapper.scrollTop = scrollTop;
         
         console.log(`📍 스마트 뷰 설정 완료: 스크롤(${scrollLeft.toFixed(0)}, ${scrollTop.toFixed(0)}) - 개체들 중심으로 이동`);
     }
     
     /**
      * 렌더링된 개체들의 경계 계산
      */
     calculateContentBounds() {
         const canvas = document.getElementById('viewerCanvas');
         if (!canvas) return null;
         
         // 건물, 교실, 도형 등 모든 개체 선택
         const elements = canvas.querySelectorAll('.building, .room, .shape, .wireless-ap');
         
         if (elements.length === 0) {
             console.log('📍 렌더링된 개체가 없습니다');
             return null;
         }
         
         let minX = Infinity;
         let minY = Infinity;
         let maxX = -Infinity;
         let maxY = -Infinity;
         
         let validElementCount = 0;
         
         elements.forEach((element, index) => {
             try {
                 const style = element.style;
                 const left = parseFloat(style.left) || 0;
                 const top = parseFloat(style.top) || 0;
                 const width = parseFloat(style.width) || 120;
                 const height = parseFloat(style.height) || 105;
                 
                 // 유효한 위치인지 확인
                 if (left >= 0 && top >= 0) {
                     minX = Math.min(minX, left);
                     minY = Math.min(minY, top);
                     maxX = Math.max(maxX, left + width);
                     maxY = Math.max(maxY, top + height);
                     validElementCount++;
                     
                     console.log(`📦 개체 ${index + 1}: ${element.className} (${left}, ${top}) - ${width}×${height}`);
                 }
             } catch (error) {
                 console.warn('📦 개체 파싱 오류:', error, element);
             }
         });
         
         if (validElementCount === 0 || minX === Infinity) {
             console.log('📍 유효한 개체가 없습니다');
             return null;
         }
         
         const bounds = {
             left: minX,
             top: minY,
             right: maxX,
             bottom: maxY,
             width: maxX - minX,
             height: maxY - minY,
             centerX: (minX + maxX) / 2,
             centerY: (minY + maxY) / 2,
             count: validElementCount
         };
         
         console.log(`📊 경계 계산 완료: ${validElementCount}개 개체 - 영역(${bounds.width.toFixed(0)}×${bounds.height.toFixed(0)}) 중심(${bounds.centerX.toFixed(0)}, ${bounds.centerY.toFixed(0)})`);
         
         return bounds;
     }
    
    /**
     * 장비 아이콘 토글 (무선AP와 상호배타적)
     */
    async toggleDeviceIcons(fromApToggle = false) {
        // 무선AP가 활성화되어 있으면 먼저 끄기 (무한 루프 방지)
        if (this.apIconsVisible && !fromApToggle) {
            this.apIconsVisible = false;
            const apToggle = document.getElementById('viewerApToggle');
            if (apToggle) {
                apToggle.classList.remove('active');
            }
            this.hideAllApIcons();
        }
        
        this.deviceIconsVisible = !this.deviceIconsVisible;
        
        const toggle = document.getElementById('viewerDeviceToggle');
        if (toggle) {
            toggle.classList.toggle('active', this.deviceIconsVisible);
        }
        
        if (this.deviceIconsVisible) {
            // 장비 아이콘 로드 및 표시
            const floorPlanData = { rooms: this.getRenderedRooms() };
            await this.loadAllDeviceIcons(floorPlanData);
            this.updateDeviceLegend();
        } else {
            // 장비 아이콘 숨김
            const deviceContainers = document.querySelectorAll('#viewerCanvas .room-devices');
            deviceContainers.forEach(container => {
                container.style.display = 'none';
            });
            this.hideDeviceLegend();
        }
        
        console.log(`🔧 뷰어 장비 아이콘 ${this.deviceIconsVisible ? '표시' : '숨김'}`);
    }
    
    /**
     * 무선AP 아이콘 토글 (장비정보와 상호배타적)
     */
    async toggleApIcons(fromDeviceToggle = false) {
        // 장비정보가 활성화되어 있으면 먼저 끄기 (무한 루프 방지)
        if (this.deviceIconsVisible && !fromDeviceToggle) {
            this.deviceIconsVisible = false;
            const deviceToggle = document.getElementById('viewerDeviceToggle');
            if (deviceToggle) {
                deviceToggle.classList.remove('active');
            }
            // 장비 아이콘 숨김
            const deviceContainers = document.querySelectorAll('#viewerCanvas .room-devices');
            deviceContainers.forEach(container => {
                container.style.display = 'none';
            });
        }
        
        this.apIconsVisible = !this.apIconsVisible;
        
        const toggle = document.getElementById('viewerApToggle');
        if (toggle) {
            toggle.classList.toggle('active', this.apIconsVisible);
        }
        
        if (this.apIconsVisible) {
            // 무선AP 정보 로드 및 표시
            await this.loadAndDisplayApIcons();
        } else {
            // 무선AP 정보 숨김
            this.hideAllApIcons();
        }
        
        console.log(`📶 뷰어 무선AP 아이콘 ${this.apIconsVisible ? '표시' : '숨김'}`);
    }
    
    /**
     * 모든 무선AP 아이콘 로드 및 표시
     */
    async loadAndDisplayApIcons() {
        try {
            console.log('📶 무선AP 정보 로딩 시작...');
            
            // 학교의 모든 무선AP 조회
            const response = await fetch(`/api/wireless-aps/school/${this.currentSchoolId}`);
            if (!response.ok) {
                throw new Error('무선AP 데이터 조회 실패');
            }
            
            const wirelessAps = await response.json();
            console.log('📶 로드된 무선AP 데이터:', wirelessAps);
            
            // 기존 무선AP 표시 제거
            this.hideAllApIcons();
            
            // 캔버스에 무선AP 아이콘 표시
            this.renderApIcons(wirelessAps);
            
        } catch (error) {
            console.error('무선AP 정보 로딩 실패:', error);
            this.showError('무선AP 정보를 불러오는데 실패했습니다.');
        }
    }
    
    /**
     * 무선AP 아이콘 렌더링
     */
    renderApIcons(wirelessAps) {
        const canvas = document.getElementById('viewerCanvas');
        if (!canvas || !wirelessAps || wirelessAps.length === 0) return;
        
        console.log(`📶 ${wirelessAps.length}개 무선AP 아이콘 렌더링 시작`);
        
        wirelessAps.forEach((ap, index) => {
            try {
                const apElement = this.createApIconElement(ap);
                canvas.appendChild(apElement);
                console.log(`✅ 무선AP ${index + 1} 렌더링: ${ap.name || ap.apName || 'AP'}`);
            } catch (error) {
                console.error(`❌ 무선AP ${index + 1} 렌더링 실패:`, error, ap);
            }
        });
    }
    
    /**
     * 무선AP 아이콘 요소 생성
     */
    createApIconElement(ap) {
        const element = document.createElement('div');
        element.className = 'viewer-ap-icon';
        element.dataset.apId = ap.id || ap.apId;
        
        // 위치 설정 (좌표가 있는 경우)
        const x = ap.xCoordinate || ap.x || Math.random() * 500;
        const y = ap.yCoordinate || ap.y || Math.random() * 300;
        
        element.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 50px;
            height: 50px;
            background: linear-gradient(145deg, #4CAF50, #45a049);
            border: 3px solid #2E7D32;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.7rem;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            transition: transform 0.2s ease;
        `;
        
        // 호버 효과
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'scale(1.1)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'scale(1)';
        });
        
        // AP 정보 표시
        const apName = ap.name || ap.apName || 'AP';
        const apInfo = ap.description || ap.location || '';
        
        element.innerHTML = `
            <div style="text-align: center; line-height: 1;">
                <i class="fas fa-wifi" style="font-size: 16px; display: block; margin-bottom: 2px;"></i>
                <span style="font-size: 8px;">${apName.substring(0, 4)}</span>
            </div>
        `;
        
        // 클릭 시 상세 정보 표시
        element.addEventListener('click', () => {
            this.showApDetails(ap);
        });
        
        // 툴팁 추가
        element.title = `${apName}${apInfo ? '\n' + apInfo : ''}`;
        
        return element;
    }
    
    /**
     * 무선AP 상세 정보 표시
     */
    showApDetails(ap) {
        const details = `
무선AP 정보:
이름: ${ap.name || ap.apName || 'AP'}
위치: ${ap.location || ap.description || '정보 없음'}
MAC: ${ap.macAddress || '정보 없음'}
상태: ${ap.status || '정보 없음'}
        `.trim();
        
        alert(details);
    }
    
    /**
     * 현재 렌더링된 교실 정보 가져오기
     */
    getRenderedRooms() {
        const rooms = [];
        const roomElements = document.querySelectorAll('#viewerCanvas .room[data-classroom-id]');
        
        roomElements.forEach(element => {
            const classroomId = element.dataset.classroomId;
            if (classroomId && classroomId !== 'null' && !classroomId.startsWith('temp_')) {
                const roomName = element.textContent || element.querySelector('.room-name')?.textContent || '교실';
                rooms.push({
                    classroomId: classroomId,
                    roomName: roomName,
                    element: element
                });
            }
        });
        
        console.log('🏫 렌더링된 교실 정보:', rooms);
        return rooms;
    }
    
    /**
     * 모든 무선AP 아이콘 숨김
     */
    hideAllApIcons() {
        const apIcons = document.querySelectorAll('#viewerCanvas .viewer-ap-icon');
        apIcons.forEach(icon => {
            icon.remove();
        });
        console.log('📶 모든 무선AP 아이콘 제거됨');
    }
    
    /**
     * 장비 범례 업데이트 (DB 기반 모든 장비 표시)
     */
    updateDeviceLegend() {
        const legend = document.getElementById('deviceLegend');
        const legendItems = document.getElementById('legendItems');
        
        if (!legend || !legendItems) return;
        
        // 현재 표시된 장비 타입 수집
        const visibleDeviceTypes = new Set();
        const deviceContainers = document.querySelectorAll('#viewerCanvas .room-devices');
        
        deviceContainers.forEach(container => {
            if (container.style.display !== 'none') {
                const deviceIcons = container.querySelectorAll('.device-icon');
                deviceIcons.forEach(icon => {
                    const deviceType = icon.dataset.deviceType;
                    if (deviceType) {
                        visibleDeviceTypes.add(deviceType);
                    }
                });
            }
        });
        
        // DB에서 확인된 실제 장비 종류들 (사용 빈도순)
        const realDeviceTypes = [
            '모니터', '데스크톱', 'TV', '프린터', '프로젝터', 
            '전자칠판', '노트북', '키오스크'
        ];
        
        // 범례 아이템 생성 (모든 주요 장비 표시)
        legendItems.innerHTML = '';
        
        realDeviceTypes.forEach(deviceType => {
            const deviceInfo = this.deviceColorMap[deviceType] || this.deviceColorMap['기타'];
            const isVisible = visibleDeviceTypes.has(deviceType);
            const legendItem = this.createLegendItem(deviceType, deviceInfo, isVisible);
            legendItems.appendChild(legendItem);
        });
        
        // 기타 표시된 장비들도 추가 (실제 DB에 없지만 현재 보이는 경우)
        visibleDeviceTypes.forEach(deviceType => {
            if (!realDeviceTypes.includes(deviceType)) {
                const deviceInfo = this.deviceColorMap[deviceType] || this.deviceColorMap['기타'];
                const legendItem = this.createLegendItem(deviceType, deviceInfo, true);
                legendItems.appendChild(legendItem);
            }
        });
        
        // 항상 범례 표시
        legend.style.display = 'block';
        console.log('📋 장비 범례 업데이트 - 표시된 장비:', Array.from(visibleDeviceTypes));
    }
    
    /**
     * 범례 아이템 생성
     */
    createLegendItem(deviceType, deviceInfo, isVisible = true) {
        const item = document.createElement('div');
        item.className = `legend-item ${!isVisible ? 'legend-inactive' : ''}`;
        
        const icon = document.createElement('div');
        icon.className = 'legend-icon';
        icon.style.backgroundColor = deviceInfo.color;
        icon.style.opacity = isVisible ? '1' : '0.3';
        icon.innerHTML = `<i class="${deviceInfo.icon}"></i>`;
        
        const label = document.createElement('span');
        label.textContent = deviceInfo.name;
        label.style.opacity = isVisible ? '1' : '0.5';
        
        // 장비 개수 표시 (현재 보이는 경우)
        if (isVisible) {
            const deviceContainers = document.querySelectorAll('#viewerCanvas .room-devices');
            let totalCount = 0;
            
            deviceContainers.forEach(container => {
                if (container.style.display !== 'none') {
                    const deviceIcons = container.querySelectorAll(`.device-icon[data-device-type="${deviceType}"]`);
                    deviceIcons.forEach(icon => {
                        const countSpan = icon.querySelector('span');
                        if (countSpan) {
                            totalCount += parseInt(countSpan.textContent) || 0;
                        }
                    });
                }
            });
            
            if (totalCount > 0) {
                const countBadge = document.createElement('span');
                countBadge.className = 'legend-count';
                countBadge.textContent = totalCount;
                countBadge.style.cssText = `
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    font-size: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 4px;
                `;
                item.appendChild(countBadge);
            }
        }
        
        item.appendChild(icon);
        item.appendChild(label);
        
        return item;
    }
    
    /**
     * 장비 범례 숨김
     */
    hideDeviceLegend() {
        const legend = document.getElementById('deviceLegend');
        if (legend) {
            legend.style.display = 'none';
            console.log('📋 장비 범례 숨김');
        }
    }
    
    /**
     * 캔버스 초기화
     */
    clearCanvas() {
        const canvas = document.getElementById('viewerCanvas');
        if (canvas) {
            canvas.innerHTML = '';
        }
        this.renderedElements = [];
    }
    
    /**
     * 알림 표시
     */
    showNotification(message, type = 'info') {
        // FloorPlanManager의 알림 시스템 활용
        if (this.floorPlanManager && this.floorPlanManager.showNotification) {
            this.floorPlanManager.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
         /**
      * 오류 표시
      */
     showError(message) {
         this.showNotification(message, 'error');
     }
     
     /**
      * 간소화된 컨트롤 바인딩
      */
     bindMiniControls() {
         // 간소화된 확대 버튼
         document.getElementById('miniZoomIn')?.addEventListener('click', () => {
             this.zoomIn();
             this.updateMiniZoomDisplay();
         });
         
         // 간소화된 축소 버튼
         document.getElementById('miniZoomOut')?.addEventListener('click', () => {
             this.zoomOut();
             this.updateMiniZoomDisplay();
         });
         
         console.log('🎛️ 간소화된 컨트롤 바인딩 완료');
     }
     
     /**
      * 간소화된 줌 표시 업데이트
      */
     updateMiniZoomDisplay() {
         const miniZoomLevel = document.getElementById('miniZoomLevel');
         if (miniZoomLevel) {
             miniZoomLevel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
         }
     }
     
     /**
      * 헤더 토글 버튼 바인딩 (재시도 로직 포함)
      */
     bindHeaderToggle() {
         const tryBind = (attempt = 1) => {
             const headerToggleBtn = document.getElementById('headerToggleBtn');
             if (headerToggleBtn) {
                 // 기존 이벤트 제거 (중복 방지)
                 headerToggleBtn.removeEventListener('click', this.handleHeaderToggle);
                 
                 // 새 이벤트 바인딩
                 this.handleHeaderToggle = () => {
                     console.log('📄 헤더 토글 버튼 클릭됨');
                     this.toggleHeader();
                 };
                 
                 headerToggleBtn.addEventListener('click', this.handleHeaderToggle);
                 console.log(`📄 헤더 토글 버튼 바인딩 완료 (시도 ${attempt})`);
             } else {
                 console.warn(`⚠️ 헤더 토글 버튼을 찾을 수 없습니다 (시도 ${attempt})`);
                 
                 // 최대 3번까지 재시도
                 if (attempt < 3) {
                     setTimeout(() => tryBind(attempt + 1), 500);
                 }
             }
         };
         
         tryBind();
     }
     
     /**
      * 헤더 접기/펼치기 토글
      */
     toggleHeader() {
         const header = document.querySelector('.viewer-header');
         const toggleBtn = document.getElementById('headerToggleBtn');
         const toggleIcon = toggleBtn?.querySelector('i');
         const miniControls = document.getElementById('miniControls');
         const fullControls = document.getElementById('fullControls');
         
         console.log('📄 toggleHeader 실행:', { header: !!header, toggleBtn: !!toggleBtn });
         
         if (!header || !toggleBtn) {
             console.error('❌ 헤더 또는 토글 버튼을 찾을 수 없습니다');
             return;
         }
         
         const isCollapsed = header.classList.contains('collapsed');
         
         if (isCollapsed) {
             // 펼치기
             header.classList.remove('collapsed');
             if (toggleIcon) {
                 toggleIcon.className = 'fas fa-chevron-up'; // 펼쳤을 때 위 화살표
             }
             toggleBtn.title = '헤더 접기';
             this.isHeaderCollapsed = false;
             
             // 간소화된 컨트롤 숨기고 전체 컨트롤 표시
             if (miniControls) miniControls.style.display = 'none';
             if (fullControls) fullControls.style.display = 'flex';
             
             console.log('📄 뷰어 헤더 펼침 - 전체 컨트롤 표시');
         } else {
             // 접기
             header.classList.add('collapsed');
             if (toggleIcon) {
                 toggleIcon.className = 'fas fa-chevron-down'; // 접었을 때 아래 화살표
             }
             toggleBtn.title = '헤더 펼치기';
             this.isHeaderCollapsed = true;
             
             // 전체 컨트롤 숨기고 간소화된 컨트롤 표시
             if (fullControls) fullControls.style.display = 'none';
             if (miniControls) {
                 miniControls.style.display = 'block';
                 this.updateMiniZoomDisplay(); // 줌 레벨 동기화
             }
             
            console.log('📄 뷰어 헤더 접음 - 간소화된 컨트롤 표시');
        }
    }
    
    /**
     * 뷰어 컨테이너 초기화
     */
    initViewerContainer() {
        this.viewerContainer = document.getElementById('viewerContent');
        if (!this.viewerContainer) {
            console.error('뷰어 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 뷰어 컨테이너에 기본 스타일 적용
        this.viewerContainer.style.position = 'relative';
        this.viewerContainer.style.width = '100%';
        this.viewerContainer.style.height = '100%';
        this.viewerContainer.style.overflow = 'hidden';
        this.viewerContainer.style.background = '#f8fafc';
    }
    
    /**
     * 특정 학교의 평면도를 뷰어에 로드
     */
    async loadFloorPlan(schoolId) {
        if (!this.viewerContainer) {
            console.error('뷰어 컨테이너가 초기화되지 않았습니다.');
            return;
        }
        
        this.currentSchoolId = schoolId;
        
        try {
            // 평면도 데이터 로드
            const floorPlanData = await this.loadFloorPlanData(schoolId, true);
            
            // 뷰어 컨테이너에 렌더링
            await this.renderFloorPlanInContainer(floorPlanData);
            
            console.log('✅ 뷰어에 평면도 로드 완료:', schoolId);
        } catch (error) {
            console.error('뷰어 평면도 로드 실패:', error);
            this.showErrorMessage('평면도를 불러오는데 실패했습니다.');
        }
    }
    
    /**
     * 뷰어 컨테이너에 평면도 렌더링
     */
    async renderFloorPlanInContainer(floorPlanData) {
        if (!this.viewerContainer) return;
        
        // 기존 내용 제거
        this.viewerContainer.innerHTML = '';
        
        // 캔버스 생성
        const canvas = document.createElement('div');
        canvas.className = 'viewer-canvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'relative';
        canvas.style.background = 'white';
        canvas.style.backgroundImage = `
            linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
        `;
        canvas.style.backgroundSize = '20px 20px';
        
        this.viewerContainer.appendChild(canvas);
        
        // 평면도 요소들 렌더링
        if (floorPlanData.buildings) {
            floorPlanData.buildings.forEach(building => this.renderBuildingInViewer(building, canvas));
        }
        
        if (floorPlanData.rooms) {
            floorPlanData.rooms.forEach(room => this.renderRoomInViewer(room, canvas));
        }
        
        if (floorPlanData.shapes) {
            floorPlanData.shapes.forEach(shape => this.renderShapeInViewer(shape, canvas));
        }
        
        if (floorPlanData.otherSpaces) {
            floorPlanData.otherSpaces.forEach(space => this.renderOtherSpaceInViewer(space, canvas));
        }
        
        // 장비 아이콘 렌더링
        if (this.deviceIconsVisible && floorPlanData.deviceLocations) {
            floorPlanData.deviceLocations.forEach(device => this.renderDeviceInViewer(device, canvas));
        }
        
        // 무선AP 렌더링
        if (this.apIconsVisible && floorPlanData.wirelessApLocations) {
            floorPlanData.wirelessApLocations.forEach(ap => this.renderWirelessAPInViewer(ap, canvas));
        }
    }
    
    /**
     * 뷰어에서 건물 렌더링
     */
    renderBuildingInViewer(building, canvas) {
        const buildingElement = document.createElement('div');
        buildingElement.className = 'building viewer-building';
        buildingElement.dataset.id = building.id;
        buildingElement.dataset.name = building.name;
        
        buildingElement.style.position = 'absolute';
        buildingElement.style.left = building.x + 'px';
        buildingElement.style.top = building.y + 'px';
        buildingElement.style.width = building.width + 'px';
        buildingElement.style.height = building.height + 'px';
        buildingElement.style.border = '2px solid #3b82f6';
        buildingElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        buildingElement.style.cursor = 'default';
        
        // 건물 이름 표시
        const nameElement = document.createElement('div');
        nameElement.className = 'building-name';
        nameElement.textContent = building.name;
        nameElement.style.position = 'absolute';
        nameElement.style.top = '50%';
        nameElement.style.left = '50%';
        nameElement.style.transform = 'translate(-50%, -50%)';
        nameElement.style.fontSize = '14px';
        nameElement.style.fontWeight = 'bold';
        nameElement.style.color = '#1e40af';
        nameElement.style.textAlign = 'center';
        nameElement.style.pointerEvents = 'none';
        
        buildingElement.appendChild(nameElement);
        canvas.appendChild(buildingElement);
    }
    
    /**
     * 뷰어에서 교실 렌더링
     */
    renderRoomInViewer(room, canvas) {
        const roomElement = document.createElement('div');
        roomElement.className = 'room viewer-room';
        roomElement.dataset.id = room.id;
        roomElement.dataset.name = room.name;
        
        roomElement.style.position = 'absolute';
        roomElement.style.left = room.x + 'px';
        roomElement.style.top = room.y + 'px';
        roomElement.style.width = room.width + 'px';
        roomElement.style.height = room.height + 'px';
        roomElement.style.border = '2px solid #10b981';
        roomElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        roomElement.style.cursor = 'default';
        
        // 교실 이름 표시
        const nameElement = document.createElement('div');
        nameElement.className = 'room-name';
        nameElement.textContent = room.name;
        nameElement.style.position = 'absolute';
        nameElement.style.top = '50%';
        nameElement.style.left = '50%';
        nameElement.style.transform = 'translate(-50%, -50%)';
        nameElement.style.fontSize = '12px';
        nameElement.style.fontWeight = 'bold';
        nameElement.style.color = '#047857';
        nameElement.style.textAlign = 'center';
        nameElement.style.pointerEvents = 'none';
        
        roomElement.appendChild(nameElement);
        canvas.appendChild(roomElement);
    }
    
    /**
     * 뷰어에서 도형 렌더링
     */
    renderShapeInViewer(shape, canvas) {
        const shapeElement = document.createElement('div');
        shapeElement.className = 'shape viewer-shape';
        shapeElement.dataset.id = shape.id;
        shapeElement.dataset.type = shape.type;
        
        shapeElement.style.position = 'absolute';
        shapeElement.style.left = shape.x + 'px';
        shapeElement.style.top = shape.y + 'px';
        shapeElement.style.width = shape.width + 'px';
        shapeElement.style.height = shape.height + 'px';
        shapeElement.style.border = `${shape.thickness || 2}px solid ${shape.color || '#000000'}`;
        shapeElement.style.backgroundColor = 'transparent';
        shapeElement.style.cursor = 'default';
        
        // 도형 타입에 따른 스타일 적용
        switch (shape.type) {
            case 'circle':
                shapeElement.style.borderRadius = '50%';
                break;
            case 'line':
                shapeElement.style.height = '2px';
                break;
            case 'arrow':
                shapeElement.style.clipPath = 'polygon(0% 0%, 80% 0%, 100% 50%, 80% 100%, 0% 100%)';
                break;
        }
        
        canvas.appendChild(shapeElement);
    }
    
    /**
     * 뷰어에서 기타공간 렌더링
     */
    renderOtherSpaceInViewer(space, canvas) {
        const spaceElement = document.createElement('div');
        spaceElement.className = 'other-space viewer-other-space';
        spaceElement.dataset.id = space.id;
        spaceElement.dataset.type = space.type;
        
        spaceElement.style.position = 'absolute';
        spaceElement.style.left = space.x + 'px';
        spaceElement.style.top = space.y + 'px';
        spaceElement.style.width = space.width + 'px';
        spaceElement.style.height = space.height + 'px';
        spaceElement.style.border = '2px solid #f59e0b';
        spaceElement.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
        spaceElement.style.cursor = 'default';
        
        // 공간 이름 표시
        const nameElement = document.createElement('div');
        nameElement.className = 'space-name';
        nameElement.textContent = space.name || space.type;
        nameElement.style.position = 'absolute';
        nameElement.style.top = '50%';
        nameElement.style.left = '50%';
        nameElement.style.transform = 'translate(-50%, -50%)';
        nameElement.style.fontSize = '11px';
        nameElement.style.fontWeight = 'bold';
        nameElement.style.color = '#d97706';
        nameElement.style.textAlign = 'center';
        nameElement.style.pointerEvents = 'none';
        
        spaceElement.appendChild(nameElement);
        canvas.appendChild(spaceElement);
    }
    
    /**
     * 뷰어에서 장비 렌더링
     */
    renderDeviceInViewer(device, canvas) {
        const deviceInfo = this.deviceColorMap[device.deviceType] || this.deviceColorMap['기타'];
        
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device-icon viewer-device';
        deviceElement.dataset.deviceId = device.id;
        deviceElement.dataset.deviceType = device.deviceType;
        
        deviceElement.style.position = 'absolute';
        deviceElement.style.left = device.x + 'px';
        deviceElement.style.top = device.y + 'px';
        deviceElement.style.width = '24px';
        deviceElement.style.height = '24px';
        deviceElement.style.backgroundColor = deviceInfo.color;
        deviceElement.style.border = '1px solid #374151';
        deviceElement.style.borderRadius = '4px';
        deviceElement.style.display = 'flex';
        deviceElement.style.alignItems = 'center';
        deviceElement.style.justifyContent = 'center';
        deviceElement.style.fontSize = '12px';
        deviceElement.style.color = '#374151';
        deviceElement.style.cursor = 'default';
        
        const iconElement = document.createElement('i');
        iconElement.className = deviceInfo.icon;
        deviceElement.appendChild(iconElement);
        
        canvas.appendChild(deviceElement);
    }
    
    /**
     * 뷰어에서 무선AP 렌더링
     */
    renderWirelessAPInViewer(ap, canvas) {
        const apElement = document.createElement('div');
        apElement.className = 'wireless-ap viewer-ap';
        apElement.dataset.apId = ap.id;
        
        apElement.style.position = 'absolute';
        apElement.style.left = ap.x + 'px';
        apElement.style.top = ap.y + 'px';
        apElement.style.width = '20px';
        apElement.style.height = '20px';
        apElement.style.backgroundColor = '#8b5cf6';
        apElement.style.border = '1px solid #6d28d9';
        apElement.style.borderRadius = '50%';
        apElement.style.display = 'flex';
        apElement.style.alignItems = 'center';
        apElement.style.justifyContent = 'center';
        apElement.style.fontSize = '10px';
        apElement.style.color = 'white';
        apElement.style.cursor = 'default';
        
        const iconElement = document.createElement('i');
        iconElement.className = 'fas fa-wifi';
        apElement.appendChild(iconElement);
        
        canvas.appendChild(apElement);
    }
    
    /**
     * 에러 메시지 표시
     */
    showErrorMessage(message) {
        if (!this.viewerContainer) return;
        
        this.viewerContainer.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                flex-direction: column;
                color: #6b7280;
                font-size: 16px;
            ">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: #f59e0b;"></i>
                <p>${message}</p>
            </div>
        `;
    }
}
