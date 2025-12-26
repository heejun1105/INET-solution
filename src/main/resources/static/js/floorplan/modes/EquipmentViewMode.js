/**
 * EquipmentViewMode.js
 * 장비 보기 모드 매니저
 * 
 * 책임:
 * - 교실별 장비 카드 자동 생성 및 표시
 * - 장비 종류별 색상 구분
 * - 교실 클릭 시 자리배치 모달 표시
 */

import SeatLayoutMode from './SeatLayoutMode.js';
import LegendComponent from '../components/LegendComponent.js';

export default class EquipmentViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.devicesByClassroom = {};
        
        // 자리배치 모달을 위한 SeatLayoutMode 인스턴스
        this.seatLayoutMode = new SeatLayoutMode(core, elementManager, uiManager);
        
        // 범례 컴포넌트
        this.legendComponent = new LegendComponent(core, 'equipment');
        
        console.log('📦 EquipmentViewMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        try {
        console.log('✅ 장비보기 모드 활성화');
        
        // 현재 페이지의 요소만 필터링 (다른 페이지 요소 제거)
        // 단, 로컬 요소는 유지 (저장되지 않은 작업 내용 보존)
        const currentPage = this.core.currentPage || window.floorPlanApp?.currentPage || 1;
        const app = window.floorPlanApp;
        
        // 로컬 요소 저장소에서 현재 페이지 요소 복원 (있는 경우)
        if (app && app.localElementsByPage && app.localElementsByPage[currentPage]) {
            const savedLocalElements = app.localElementsByPage[currentPage];
            const restoredElements = JSON.parse(JSON.stringify(savedLocalElements));
            
            // 서버에서 로드한 요소의 ID 목록
            const serverElementIds = new Set(
                this.core.state.elements
                    .filter(el => el.id && !el.id.toString().startsWith('temp'))
                    .map(el => el.id.toString())
            );
            
            // 로컬 요소만 필터링
            const localOnlyElements = restoredElements.filter(el => {
                if (!el.id || el.id.toString().startsWith('temp')) {
                    return true;
                }
                return !serverElementIds.has(el.id.toString());
            });
            
            if (localOnlyElements.length > 0) {
                this.core.state.elements = [...this.core.state.elements, ...localOnlyElements];
                console.log(`📂 장비보기 모드: 페이지 ${currentPage}의 로컬 요소 ${localOnlyElements.length}개 복원`);
            }
        }
        
        // 현재 페이지의 요소만 필터링 (AP는 나중에 로드하므로 일단 제외)
        // 무선AP 설계 모드에서 수정한 AP 요소는 유지하기 위해 필터링 전에 백업
        const allElementsBeforeFilter = [...this.core.state.elements];
        const apElementsBeforeFilter = allElementsBeforeFilter.filter(el => 
            el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf'
        );
        
        this.core.state.elements = this.core.state.elements.filter(el => {
            // AP/MDF는 나중에 로드하므로 일단 제외
            if (el.elementType === 'wireless_ap' || el.elementType === 'mdf_idf') {
                return false;
            }
            // 나머지 요소는 현재 페이지만
            return el.pageNumber === currentPage || el.pageNumber === null || el.pageNumber === undefined;
        });
        console.log(`📄 현재 페이지 ${currentPage}의 요소만 표시: ${this.core.state.elements.length}개 (AP 제외)`);
        
        // 모든 요소 잠금 (보기 모드에서는 이동 불가)
        this.lockAllElements();
        
        // 무선AP 요소 로드 (장비 보기 모드에서도 AP 표시)
        // 무선AP 설계 모드에서 수정한 AP 요소도 포함하여 로드
        await this.loadWirelessAps(apElementsBeforeFilter);
        
        await this.loadDevices();
        this.renderEquipmentCards();
        this.bindEvents();
        
        // 범례 생성
            if (this.legendComponent && typeof this.legendComponent.create === 'function') {
        this.legendComponent.create();
            }
        
        // 강제 렌더링 (카메라 위치/줌은 이전 모드(예: 교실설계)의 상태를 그대로 유지)
        this.core.markDirty();
        this.core.render && this.core.render();
        } catch (error) {
            console.error('❌ 장비보기 모드 활성화 오류:', error);
            throw error; // 에러를 다시 throw하여 상위에서 처리할 수 있도록
        }
    }
    
    /**
     * 모든 요소 잠금
     */
    lockAllElements() {
        const elements = this.elementManager.getAllElements();
        elements.forEach(element => {
            element.isLocked = true;
            this.elementManager.updateElement(element.id, { isLocked: true });
        });
        console.log('🔒 모든 요소 잠금 (장비보기 모드)');
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 장비보기 모드 비활성화');
        this.clearEquipmentCards();
        this.clearApElements();
        this.unbindEvents();
        this.legendComponent.remove();
    }
    
    /**
     * AP/MDF 요소 제거
     */
    clearApElements() {
        const elements = this.elementManager.getAllElements();
        const apElements = elements.filter(e => 
            e.elementType === 'wireless_ap' || 
            e.elementType === 'mdf_idf' ||
            e.type === 'wireless_ap' || 
            e.type === 'mdf_idf'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
    
    /**
     * 페이지 전환 시 호출
     */
    onPageSwitch(pageNumber) {
        console.log(`📄 장비보기 모드: 페이지 ${pageNumber}로 전환`);
        // 기존 장비 카드 제거
        this.clearEquipmentCards();
        // 기존 AP 요소 제거
        this.clearApElements();
        // 새 페이지의 AP 로드
        this.loadWirelessAps();
        // 새 페이지의 장비 카드 렌더링
        this.renderEquipmentCards();
    }
    
    /**
     * 무선AP 로드 (장비 보기 모드에서도 AP 표시)
     * @param {Array} existingApElements - 무선AP 설계 모드에서 수정한 AP 요소들 (선택적)
     */
    async loadWirelessAps(existingApElements = null) {
        try {
            const schoolId = this.core.currentSchoolId;
            if (!schoolId) return;
            
            // 무선AP 설계 모드에서 수정한 AP 요소가 있으면 먼저 처리
            if (existingApElements && existingApElements.length > 0) {
                const currentPage = this.core.currentPage || 1;
                // 현재 페이지의 AP만 필터링
                const currentPageAps = existingApElements.filter(ap => {
                    const apPage = ap.pageNumber || 1;
                    return apPage === currentPage;
                });
                
                if (currentPageAps.length > 0) {
                    console.log(`📡 무선AP 설계 모드에서 수정한 AP 요소 ${currentPageAps.length}개 복원 (장비 보기 모드)`);
                    // AP 요소를 core.state.elements에 추가
                    currentPageAps.forEach(ap => {
                        // 이미 있는지 확인
                        const existing = this.core.state.elements.find(el => 
                            el.id === ap.id || 
                            (el.elementType === 'wireless_ap' && el.referenceId === ap.referenceId)
                        );
                        if (!existing) {
                            this.core.state.elements.push(ap);
                        }
                    });
                }
            }
            
            // 저장된 AP/MDF 로드
            await this.loadSavedApMdfElements();
            
            // 무선AP 데이터 로드 및 렌더링
            await this.loadAndRenderWirelessAps();
        } catch (error) {
            console.error('무선AP 로드 오류 (장비 보기 모드):', error);
        }
    }
    
    /**
     * 저장된 AP/MDF 요소 로드
     */
    async loadSavedApMdfElements() {
        try {
            const schoolId = this.core.currentSchoolId;
            if (!schoolId) return;
            
            // 평면도 데이터 로드
            const response = await fetch(`/floorplan/api/schools/${schoolId}`);
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.elements) {
                console.log('ℹ️ 저장된 AP/MDF 데이터 없음 (장비 보기 모드)');
                return;
            }
            
            const elements = result.data.elements;
            const savedAps = elements.filter(el => el.elementType === 'wireless_ap');
            const savedMdfs = elements.filter(el => el.elementType === 'mdf_idf');
            
            console.log('📥 저장된 AP/MDF 로드 (장비 보기 모드):', {
                ap: savedAps.length,
                mdf: savedMdfs.length
            });
            
            // 저장된 MDF 요소 추가
            savedMdfs.forEach(mdfData => {
                const mdfElement = {
                    id: mdfData.id || `mdf_${Date.now()}_${Math.random()}`,
                    elementType: 'mdf_idf',
                    xCoordinate: mdfData.xCoordinate,
                    yCoordinate: mdfData.yCoordinate,
                    width: mdfData.width || 40,
                    height: mdfData.height || 60,
                    borderColor: mdfData.borderColor || '#000000',
                    backgroundColor: mdfData.backgroundColor || '#ef4444',
                    borderWidth: mdfData.borderWidth || 2,
                    zIndex: mdfData.zIndex || 900,
                    pageNumber: mdfData.pageNumber || (this.core.currentPage || 1),
                    isLocked: true // 읽기 전용
                };
                
                this.elementManager.addElement(mdfElement);
                console.log('✅ 저장된 MDF 로드 (장비 보기 모드):', mdfElement);
            });
            
            // 저장된 AP 위치 맵 생성 (referenceId 기준)
            this.savedApPositions = {};
            savedAps.forEach(apData => {
                if (apData.referenceId) {
                    const shapeType = apData.shapeType || 'circle';
                    let width = apData.width;
                    let height = apData.height;
                    
                    // circle 또는 circle-l인 경우 radius로부터 width/height 계산
                    if ((shapeType === 'circle' || shapeType === 'circle-l') && apData.radius) {
                        width = apData.radius * 2;
                        height = apData.radius * 2;
                    } else {
                        width = width || 40;
                        height = height || 40;
                    }
                    
                    // 교실 기준 상대 좌표 (offset) 그대로 사용
                    const offsetX = apData.xCoordinate || 0;
                    const offsetY = apData.yCoordinate || 0;
                    
                    this.savedApPositions[apData.referenceId] = {
                        x: offsetX,
                        y: offsetY,
                        backgroundColor: apData.backgroundColor,
                        borderColor: apData.borderColor,
                        letterColor: apData.letterColor || '#000000',
                        shapeType: shapeType,
                        width: width,
                        height: height,
                        radius: (shapeType === 'circle' || shapeType === 'circle-l') ? (apData.radius || width / 2) : null
                    };
                }
            });
            
        } catch (error) {
            console.error('저장된 AP/MDF 로드 오류 (장비 보기 모드):', error);
        }
    }
    
    /**
     * 저장된 AP 위치 가져오기
     */
    getSavedApPosition(apId) {
        if (!this.savedApPositions) return null;
        return this.savedApPositions[apId] || null;
    }
    
    /**
     * 무선AP 로드 및 렌더링
     */
    async loadAndRenderWirelessAps() {
        try {
            const schoolId = this.core.currentSchoolId;
            
            // 무선AP 로드
            const apResponse = await fetch(`/floorplan/api/schools/${schoolId}/wireless-aps`);
            const apResult = await apResponse.json();
            
            if (apResult.success) {
                this.renderWirelessAps(apResult.wirelessAps);
            }
            
            this.core.markDirty();
        } catch (error) {
            console.error('무선AP 로드 오류 (장비 보기 모드):', error);
        }
    }
    
    /**
     * 무선AP 렌더링
     */
    renderWirelessAps(wirelessAps) {
        console.log('📡 무선AP 렌더링 시작 (장비 보기 모드):', wirelessAps.length, '개');
        
        let createdCount = 0;
        let skippedCount = 0;
        
        wirelessAps.forEach(ap => {
            if (!ap.classroomId) {
                skippedCount++;
                return;
            }
            
            // classroomId를 숫자로 변환
            const targetClassroomId = typeof ap.classroomId === 'string' 
                ? parseInt(ap.classroomId, 10) 
                : ap.classroomId;
            
            if (!targetClassroomId || isNaN(targetClassroomId)) {
                console.log('⚠️ 유효하지 않은 classroomId:', ap.classroomId, 'AP:', ap.apId);
                skippedCount++;
                return;
            }
            
            // 교실 요소 찾기 (WirelessApDesignMode와 동일한 로직)
            let roomElement = this.elementManager.findElementByReferenceId(targetClassroomId);
            
            // referenceId로 찾지 못한 경우 다른 방법으로 찾기 시도
            if (!roomElement) {
                // 현재 페이지의 교실만 찾기 (페이지 필터링 후이므로 이미 필터링됨)
                const currentPage = this.core.currentPage || 1;
                const allRooms = this.core.state.elements.filter(e => {
                    if (e.elementType !== 'room') return false;
                    const roomPage = e.pageNumber || 1;
                    return roomPage === currentPage;
                });
                roomElement = allRooms.find(r => {
                    // 1. referenceId로 매칭 (타입 변환)
                    const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                    if (rRefId && rRefId === targetClassroomId) {
                        return true;
                    }
                    // 2. classroomId로 매칭 (타입 변환)
                    const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                    if (rClassroomId && rClassroomId === targetClassroomId) {
                        return true;
                    }
                    // 3. element_data에서 classroomId 확인
                    if (r.elementData) {
                        try {
                            const elementData = typeof r.elementData === 'string' 
                                ? JSON.parse(r.elementData) 
                                : r.elementData;
                            if (elementData) {
                                const dataClassroomId = typeof elementData.classroomId === 'string' 
                                    ? parseInt(elementData.classroomId, 10) 
                                    : elementData.classroomId;
                                if (dataClassroomId && dataClassroomId === targetClassroomId) {
                                    return true;
                                }
                                // referenceId도 확인
                                const dataRefId = typeof elementData.referenceId === 'string' 
                                    ? parseInt(elementData.referenceId, 10) 
                                    : elementData.referenceId;
                                if (dataRefId && dataRefId === targetClassroomId) {
                                    return true;
                                }
                            }
                        } catch (e) {
                            // 파싱 실패 시 무시
                        }
                    }
                    return false;
                }) || null;
            }
            
            if (!roomElement) {
                console.log('⚠️ 교실 요소를 찾을 수 없음 - classroomId:', targetClassroomId, '(원본:', ap.classroomId, ')', '교실명:', ap.classroomName, 'AP ID:', ap.apId);
                skippedCount++;
                return;
            }
            
            // 저장된 위치 확인
            const savedPosition = this.getSavedApPosition(ap.apId);
            
            const DEFAULT_RADIUS = 20;
            const DEFAULT_SIZE = DEFAULT_RADIUS * 2;
            let shapeType = 'circle';
            let width = DEFAULT_SIZE;
            let height = DEFAULT_SIZE;
            let radius = DEFAULT_RADIUS;
            let centerX;
            let centerY;
            let backgroundColor = '#ef4444';
            let borderColor = '#000000';
            let letterColor = '#000000';
            
            if (savedPosition) {
                shapeType = savedPosition.shapeType || 'circle';
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
                letterColor = savedPosition.letterColor || letterColor;
                
                // 저장된 위치는 교실 기준 오프셋이므로 절대 좌표로 변환
                const offsetX = savedPosition.x || 0;
                const offsetY = savedPosition.y || 0;
                centerX = roomElement.xCoordinate + offsetX;
                centerY = roomElement.yCoordinate + offsetY;
                
                // circle 또는 circle-l인 경우
                if (shapeType === 'circle' || shapeType === 'circle-l') {
                    radius = savedPosition.radius ?? DEFAULT_RADIUS;
                    width = radius * 2;
                    height = radius * 2;
                } else {
                    width = savedPosition.width || DEFAULT_SIZE;
                    height = savedPosition.height || DEFAULT_SIZE;
                }
            } else {
                // 기본 위치 (교실 중앙 살짝 아래)
                shapeType = 'circle';
                const baseCenterX = roomElement.xCoordinate + (roomElement.width || 100) / 2;
                const baseCenterY = roomElement.yCoordinate + (roomElement.height || 100) / 2 + 30;
                centerX = baseCenterX;
                centerY = baseCenterY;
                radius = DEFAULT_RADIUS;
                width = DEFAULT_SIZE;
                height = DEFAULT_SIZE;
            }
            
            // 좌상단 좌표 계산
            const x = centerX - width / 2;
            const y = centerY - height / 2;
            
            // 페이지 번호: 교실(Room)과 동일한 페이지에 표시되도록 설정
            const pageNumber = roomElement.pageNumber != null 
                ? roomElement.pageNumber 
                : (this.core.currentPage || this.core.state.currentPage || 1);
            
            const apElement = {
                type: 'wireless_ap',
                elementType: 'wireless_ap',
                referenceId: ap.apId,
                parentElementId: roomElement.id,
                xCoordinate: x,
                yCoordinate: y,
                width,
                height,
                radius: (shapeType === 'circle' || shapeType === 'circle-l') ? radius : null,
                shapeType,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                letterColor: letterColor,
                borderWidth: 2,
                label: ap.newLabelNumber,
                pageNumber,
                zIndex: 1000,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(apElement);
            createdCount++;
            console.log('✅ AP 생성 완료 (장비 보기 모드):', ap.apId, ap.newLabelNumber, '교실:', roomElement.label || roomElement.id, '페이지:', pageNumber);
        });
        
        console.log('✅ 무선AP 렌더링 완료 (장비 보기 모드): 생성', createdCount, '개, 스킵', skippedCount, '개');
        
        // 강제 렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
    }
    
    /**
     * 장비 데이터 로드
     */
    async loadDevices() {
        try {
            const schoolId = this.core.currentSchoolId;
            const response = await fetch(`/floorplan/api/schools/${schoolId}/devices-by-classroom`);
            const result = await response.json();
            
            if (result.success) {
                this.devicesByClassroom = result.devicesByClassroom;
            }
        } catch (error) {
            console.error('장비 로드 오류:', error);
        }
    }
    
    /**
     * 장비 카드 렌더링
     */
    renderEquipmentCards() {
        try {
            if (!this.core || !this.core.state || !this.core.state.elements) {
                console.warn('⚠️ Core 또는 state가 초기화되지 않았습니다.');
                return;
            }
            
        const elements = this.core.state.elements;
            // 현재 페이지의 요소만 필터링
            const currentPage = this.core.currentPage || window.floorPlanApp?.currentPage || 1;
            const roomElements = elements.filter(e => 
                e && 
                e.elementType === 'room' && 
                (e.pageNumber === currentPage || e.pageNumber === null || e.pageNumber === undefined)
            );
        
        roomElements.forEach(room => {
                try {
                    if (!room || (!room.referenceId && !room.classroomId)) return;
            
            const classroomId = room.referenceId || room.classroomId;
            const devices = this.devicesByClassroom[classroomId] || [];
            if (devices.length === 0) return;
            
            // 고유번호 카테고리별 개수 집계
            const deviceCounts = {};
            devices.forEach(device => {
                const cate = device.uidCate || '미분류';  // 고유번호 카테고리 사용
                deviceCounts[cate] = (deviceCounts[cate] || 0) + 1;
            });
            
            // 카드 배치 계산
            const cards = Object.entries(deviceCounts).map(([cate, count]) => ({
                type: cate,  // 카테고리를 type으로 전달
                count,
                color: this.getDeviceColor(cate),
                text: `${cate} ${count}`
            }));
            
            this.layoutCards(room, cards);
                } catch (error) {
                    console.error('❌ 교실 장비 렌더링 오류:', error, room);
                }
        });
        
        this.core.markDirty();
        } catch (error) {
            console.error('❌ 장비 카드 렌더링 오류:', error);
        }
    }
    
    /**
     * 텍스트 형태로 장비 표시 (카드 형태 제거)
     */
    layoutCards(room, cards) {
        const roomX = room.xCoordinate;
        const roomY = room.yCoordinate;
        const roomW = room.width || 100;
        const roomH = room.height || 80;
        
        // 텍스트 생성: "TV 1, DK 6, ..." 형식
        const textParts = cards.map(card => `${card.type} ${card.count}`);
        const text = textParts.join(', ');
        
        // 위치: 교실 높이의 3/5 지점
        const textY = roomY + (roomH * 3 / 5);
        const textX = roomX; // 중앙 정렬을 위해 x는 교실 시작점으로 설정 (렌더링 시 중앙 계산)
        
        // 텍스트 요소 생성 (카드 형태 제거)
        const textElement = {
            id: `equipment_text_${room.id}`,
            elementType: 'equipment_card', // 렌더링 타입은 유지하되 내용만 텍스트
                parentElementId: room.id,
            xCoordinate: textX,
            yCoordinate: textY,
            width: roomW, // 교실 전체 너비 사용 (중앙 정렬)
            height: roomH / 3, // 교실 높이의 1/3 (아래 3분의 1 영역)
            roomHeight: roomH, // 교실 높이 정보 저장 (폰트 크기 계산용)
            text: text, // 전체 텍스트
            cards: cards, // 개별 카드 정보 (줄바꿈 계산용)
                zIndex: 1000
            };
            
        this.core.state.elements.push(textElement);
    }
    
    /**
     * 장비 종류별 색상 (데이터베이스 기준, 가시성 최적화 - WCAG AAA 대비)
     */
    getDeviceColor(cate) {
        // 고유번호 카테고리별 색상 매핑 (데이터베이스 기준)
        // 더 어두운 700-800 계열 사용 → 흰색 텍스트와 대비비율 7:1 이상 (WCAG AAA)
        const colors = {
            // 데이터베이스 카테고리 (9개)
            'TV': '#b91c1c',           // 매우 진한 빨강 (Red 800) - TV
            'MO': '#1e40af',           // 매우 진한 파랑 (Blue 800) - 모니터
            'DC': '#374151',           // 매우 진한 회색 (Gray 700) - 데스크톱
            'DK': '#6d28d9',           // 매우 진한 보라 (Violet 700) - 도킹스테이션
            'DW': '#0e7490',           // 매우 진한 청록 (Cyan 700) - 무선장비
            'ET': '#15803d',           // 매우 진한 녹색 (Green 700) - 전자칠판
            'ID': '#be185d',           // 매우 진한 핑크 (Pink 700) - 학생용ID
            'PJ': '#c2410c',           // 매우 진한 주황 (Orange 700) - 프로젝터
            'PR': '#9333ea',           // 매우 진한 자주 (Purple 700) - 프린터
            // 미분류
            '미분류': '#4b5563',       // 진한 회색 (Gray 600)
            'default': '#4b5563'       // 진한 회색 (Gray 600)
        };
        
        // 매핑에 없는 카테고리는 기본 색상 사용
        return colors[cate] || colors['default'];
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // mousedown 이벤트를 capture 단계에서 먼저 처리하여 InteractionManager보다 우선 실행
        this.canvasMouseDownHandler = (e) => this.handleCanvasMouseDown(e);
        
        const canvas = this.core.canvas;
        // capture 단계에서 이벤트 처리 (InteractionManager보다 먼저 실행)
        canvas.addEventListener('mousedown', this.canvasMouseDownHandler, true);
        
        // 터치 이벤트도 처리
        this.canvasTouchStartHandler = (e) => this.handleCanvasTouchStart(e);
        canvas.addEventListener('touchstart', this.canvasTouchStartHandler, true);
    }
    
    /**
     * 이벤트 해제
     */
    unbindEvents() {
        const canvas = this.core.canvas;
        if (this.canvasMouseDownHandler) {
            canvas.removeEventListener('mousedown', this.canvasMouseDownHandler, true);
        }
        if (this.canvasTouchStartHandler) {
            canvas.removeEventListener('touchstart', this.canvasTouchStartHandler, true);
        }
    }
    
    /**
     * 캔버스 마우스 다운 처리 (보기 모드에서 잠긴 교실 클릭 허용)
     */
    handleCanvasMouseDown(e) {
        console.log('🔍 [장비보기] handleCanvasMouseDown 호출됨');
        console.log('🔍 [장비보기] 현재 모드:', this.core.state.currentMode);
        
        // 장비 보기 모드가 아니면 무시
        if (this.core.state.currentMode !== 'view-equipment') {
            console.log('⚠️ [장비보기] 장비 보기 모드가 아님, 무시');
            return;
        }
        
        // 우클릭은 무시
        if (e.button === 2) {
            console.log('⚠️ [장비보기] 우클릭 무시');
            return;
        }
        
        // InteractionManager와 동일한 방식으로 좌표 계산
        // screenToCanvas는 clientX, clientY를 직접 받아야 함
        const canvasPos = this.core.screenToCanvas(e.clientX, e.clientY);
        
        console.log('🔍 [장비보기] 클릭 위치 (화면 clientX/Y):', { 
            clientX: e.clientX, 
            clientY: e.clientY 
        });
        console.log('🔍 [장비보기] 클릭 위치 (캔버스):', canvasPos);
        
        // 직접 요소를 찾기 (equipment_card는 제외)
        const sortedElements = [...this.core.state.elements].sort((a, b) => {
            const aOrder = a.layerOrder || a.zIndex || 0;
            const bOrder = b.layerOrder || b.zIndex || 0;
            return bOrder - aOrder;
        });
        
        console.log('🔍 [장비보기] 전체 요소 수:', this.core.state.elements.length);
        console.log('🔍 [장비보기] 정렬된 요소 수:', sortedElements.length);
        
        let clickedElement = null;
        let checkedCount = 0;
        
        for (const element of sortedElements) {
            // equipment_card는 무시
            if (element.elementType === 'equipment_card') {
                checkedCount++;
                continue;
            }
            
            // 요소 영역 확인
            const elementX = element.x || element.xCoordinate || 0;
            const elementY = element.y || element.yCoordinate || 0;
            const elementWidth = element.width || 0;
            const elementHeight = element.height || 0;
            
            const isInBounds = canvasPos.x >= elementX && 
                              canvasPos.x <= elementX + elementWidth &&
                              canvasPos.y >= elementY && 
                              canvasPos.y <= elementY + elementHeight;
            
            if (isInBounds) {
                clickedElement = element;
                console.log('✅ [장비보기] 클릭된 요소 발견:', {
                    id: element.id,
                    elementType: element.elementType,
                    label: element.label,
                    x: elementX,
                    y: elementY,
                    width: elementWidth,
                    height: elementHeight,
                    isLocked: element.isLocked
                });
                break;
            }
            checkedCount++;
        }
        
        console.log('🔍 [장비보기] 체크한 요소 수:', checkedCount);
        
        if (!clickedElement) {
            console.log('⚠️ [장비보기] 클릭된 요소 없음');
        }
        
        // 교실 또는 이름박스 클릭 확인
        let targetRoom = null;
        
        if (clickedElement) {
            if (clickedElement.elementType === 'name_box') {
                console.log('🔍 [장비보기] 이름박스 클릭됨, 부모 요소 찾는 중...');
                // 이름 박스인 경우 부모 요소 찾기
                if (clickedElement.parentElementId) {
                    const parentElement = this.core.state.elements.find(
                        el => el.id === clickedElement.parentElementId
                    );
                    console.log('🔍 [장비보기] 부모 요소:', parentElement);
                    if (parentElement && parentElement.elementType === 'room') {
                        targetRoom = parentElement;
                        console.log('✅ [장비보기] 부모 교실 찾음:', targetRoom);
                    }
                } else {
                    console.log('⚠️ [장비보기] 이름박스에 parentElementId 없음');
                }
            } else if (clickedElement.elementType === 'room') {
                targetRoom = clickedElement;
                console.log('✅ [장비보기] 교실 직접 클릭됨:', targetRoom);
            } else {
                console.log('⚠️ [장비보기] 교실 또는 이름박스가 아님:', clickedElement.elementType);
            }
        }
        
        // 교실 클릭 시 모달 열기 (이벤트 전파 중지하여 InteractionManager로 전달 방지)
        if (targetRoom) {
            console.log('🎯 [장비보기] 교실 클릭 감지, 모달 열기 시도...');
            e.stopPropagation(); // InteractionManager로 이벤트 전달 방지
            e.stopImmediatePropagation(); // 같은 단계의 다른 리스너도 차단
            e.preventDefault(); // 기본 동작 방지
            console.log('✅ [장비보기] 이벤트 전파 차단 완료, 모달 열기 호출');
            console.log('✅ [장비보기] 교실 정보:', {
                id: targetRoom.id,
                label: targetRoom.label,
                referenceId: targetRoom.referenceId,
                classroomId: targetRoom.classroomId
            });
            this.openClassroomModal(targetRoom);
            return false; // 추가 안전장치
        } else {
            console.log('⚠️ [장비보기] targetRoom이 null, 모달 열기 안함');
        }
    }
    
    /**
     * 캔버스 터치 시작 처리 (모바일/태블릿)
     */
    handleCanvasTouchStart(e) {
        console.log('🔍 [장비보기] handleCanvasTouchStart 호출됨');
        console.log('🔍 [장비보기] 현재 모드:', this.core.state.currentMode);
        
        // 장비 보기 모드가 아니면 무시
        if (this.core.state.currentMode !== 'view-equipment') {
            console.log('⚠️ [장비보기] 장비 보기 모드가 아님, 무시');
            return;
        }
        
        if (e.touches.length !== 1) {
            console.log('⚠️ [장비보기] 단일 터치가 아님:', e.touches.length);
            return; // 단일 터치만 처리
        }
        
        const touch = e.touches[0];
        
        // InteractionManager와 동일한 방식으로 좌표 계산
        // screenToCanvas는 clientX, clientY를 직접 받아야 함
        const canvasPos = this.core.screenToCanvas(touch.clientX, touch.clientY);
        
        console.log('🔍 [장비보기] 터치 위치 (화면 clientX/Y):', { 
            clientX: touch.clientX, 
            clientY: touch.clientY 
        });
        console.log('🔍 [장비보기] 터치 위치 (캔버스):', canvasPos);
        
        // 직접 요소를 찾기 (equipment_card는 제외)
        const sortedElements = [...this.core.state.elements].sort((a, b) => {
            const aOrder = a.layerOrder || a.zIndex || 0;
            const bOrder = b.layerOrder || b.zIndex || 0;
            return bOrder - aOrder;
        });
        
        console.log('🔍 [장비보기] 전체 요소 수:', this.core.state.elements.length);
        
        let clickedElement = null;
        for (const element of sortedElements) {
            // equipment_card는 무시
            if (element.elementType === 'equipment_card') {
                continue;
            }
            
            // 요소 영역 확인
            const elementX = element.x || element.xCoordinate || 0;
            const elementY = element.y || element.yCoordinate || 0;
            const elementWidth = element.width || 0;
            const elementHeight = element.height || 0;
            
            if (canvasPos.x >= elementX && 
                canvasPos.x <= elementX + elementWidth &&
                canvasPos.y >= elementY && 
                canvasPos.y <= elementY + elementHeight) {
                clickedElement = element;
                console.log('✅ [장비보기] 터치된 요소 발견:', {
                    id: element.id,
                    elementType: element.elementType,
                    label: element.label
                });
                break;
            }
        }
        
        // 교실 또는 이름박스 클릭 확인
        let targetRoom = null;
        
        if (clickedElement) {
            if (clickedElement.elementType === 'name_box') {
                console.log('🔍 [장비보기] 이름박스 터치됨, 부모 요소 찾는 중...');
                // 이름 박스인 경우 부모 요소 찾기
                if (clickedElement.parentElementId) {
                    const parentElement = this.core.state.elements.find(
                        el => el.id === clickedElement.parentElementId
                    );
                    if (parentElement && parentElement.elementType === 'room') {
                        targetRoom = parentElement;
                        console.log('✅ [장비보기] 부모 교실 찾음:', targetRoom);
                    }
                }
            } else if (clickedElement.elementType === 'room') {
                targetRoom = clickedElement;
                console.log('✅ [장비보기] 교실 직접 터치됨:', targetRoom);
            }
        }
        
        // 교실 터치 시 모달 열기
        if (targetRoom) {
            console.log('🎯 [장비보기] 교실 터치 감지, 모달 열기 시도...');
            e.stopPropagation(); // InteractionManager로 이벤트 전달 방지
            e.stopImmediatePropagation(); // 같은 단계의 다른 리스너도 차단
            e.preventDefault(); // 기본 동작 방지
            console.log('✅ [장비보기] 이벤트 전파 차단 완료, 모달 열기 호출');
            this.openClassroomModal(targetRoom);
        } else {
            console.log('⚠️ [장비보기] targetRoom이 null, 모달 열기 안함');
        }
    }
    
    /**
     * 교실 모달 열기
     */
    async openClassroomModal(roomElement) {
        console.log('🎯 [장비보기] openClassroomModal 호출됨');
        console.log('🎯 [장비보기] 교실 요소:', {
            id: roomElement.id,
            label: roomElement.label,
            referenceId: roomElement.referenceId,
            classroomId: roomElement.classroomId
        });
        
        try {
            // SeatLayoutMode의 openClassroomModal 메서드 재사용
            console.log('🎯 [장비보기] SeatLayoutMode.openClassroomModal 호출 중...');
            await this.seatLayoutMode.openClassroomModal(roomElement);
            console.log('✅ [장비보기] 모달 열기 완료');
        } catch (error) {
            console.error('❌ [장비보기] 모달 열기 실패:', error);
        }
    }
    
    /**
     * 장비 카드 제거
     */
    clearEquipmentCards() {
        // core.state.elements에서 직접 제거
        this.core.state.elements = this.core.state.elements.filter(
            e => e.elementType !== 'equipment_card'
        );
        this.core.markDirty();
    }
}

