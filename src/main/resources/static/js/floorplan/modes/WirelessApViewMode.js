/**
 * WirelessApViewMode.js
 * 무선AP 보기 모드 매니저
 * 
 * 책임:
 * - 저장된 무선AP 표시 (읽기 전용)
 * - 네트워크 장비 표시
 */

import LegendComponent from '../components/LegendComponent.js';

export default class WirelessApViewMode {
    constructor(core, elementManager, uiManager) {
        this.core = core;
        this.elementManager = elementManager;
        this.uiManager = uiManager;
        
        this.wirelessAps = []; // 무선AP 데이터 저장 (loadSavedApMdfElements에서 사용)
        this.savedApPositions = {}; // 저장된 AP 위치 (offset)
        
        // 범례 컴포넌트
        this.legendComponent = new LegendComponent(core, 'wireless-ap');
        
        console.log('📡 WirelessApViewMode 초기화');
    }
    
    /**
     * 모드 활성화
     */
    async activate() {
        console.log('✅ 무선AP보기 모드 활성화');
        
        // 모든 요소 잠금 (보기 모드에서는 이동 불가)
        this.lockAllElements();
        
        // 먼저 기존 AP/MDF 요소 제거
        this.clearApElements();
        
        // 무선AP 데이터를 먼저 로드 (loadSavedApMdfElements에서 wirelessAps 사용)
        await this.loadAndRenderWirelessAps();
        
        // 저장된 AP/MDF 로드 (wirelessAps가 채워진 후 호출)
        await this.loadSavedApMdfElements();
        
        // AP 요소를 다시 제거하고 savedApPositions가 업데이트된 후 한 번만 렌더링
        this.clearApElements();
        if (this.wirelessAps && this.wirelessAps.length > 0) {
            this.renderWirelessAps(this.wirelessAps);
        }
        
        // 범례 생성
        this.legendComponent.create();
        
        // 강제 렌더링
        this.core.markDirty();
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
        console.log('🔒 모든 요소 잠금 (무선AP보기 모드)');
    }
    
    /**
     * 모드 비활성화
     */
    deactivate() {
        console.log('❌ 무선AP보기 모드 비활성화');
        this.clearApElements();
        this.legendComponent.remove();
    }
    
    /**
     * 페이지 전환 시 호출 (main_new_v3.js에서 호출)
     */
    async onPageSwitch(pageNumber) {
        console.log(`📄 무선AP 보기 모드 - 페이지 전환: ${pageNumber}`);
        
        // core.currentPage 업데이트
        if (this.core) {
            this.core.currentPage = pageNumber;
        }
        
        // 현재 페이지의 AP만 다시 렌더링
        // 기존 AP 요소 제거 후 다시 로드
        this.clearApElements();
        
        // 페이지 전환 시 서버에서 저장된 AP 위치를 다시 로드
        await this.loadSavedApMdfElements();
        
        // AP 다시 렌더링 (savedApPositions가 업데이트된 후)
        if (this.wirelessAps && this.wirelessAps.length > 0) {
            this.renderWirelessAps(this.wirelessAps);
        } else {
            // wirelessAps가 없으면 다시 로드 (렌더링은 하지 않음)
            await this.loadAndRenderWirelessAps();
            // loadAndRenderWirelessAps에서 이미 렌더링했으므로 clearApElements 후 다시 렌더링
            this.clearApElements();
            await this.loadSavedApMdfElements();
            if (this.wirelessAps && this.wirelessAps.length > 0) {
                this.renderWirelessAps(this.wirelessAps);
            }
        }
        
        this.core.markDirty();
        this.core.render && this.core.render();
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
                // wirelessAps 저장 (loadSavedApMdfElements에서 사용)
                this.wirelessAps = apResult.wirelessAps || [];
                this.renderWirelessAps(this.wirelessAps);
            }
            
            // 네트워크 장비 로드
            const equipResponse = await fetch(`/api/network-equipment/schools/${schoolId}`);
            const equipResult = await equipResponse.json();
            
            if (equipResult.success) {
                this.renderNetworkEquipments(equipResult.equipments);
            }
            
            this.core.markDirty();
        } catch (error) {
            console.error('무선AP 로드 오류:', error);
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
                console.log('ℹ️ 저장된 AP/MDF 데이터 없음');
                return;
            }
            
            const elements = result.data.elements;
            const savedAps = elements.filter(el => el.elementType === 'wireless_ap');
            const savedMdfs = elements.filter(el => el.elementType === 'mdf_idf');
            
            console.log('📥 저장된 AP/MDF 로드 (보기 모드):', {
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
                    isLocked: true // 읽기 전용
                };
                
                this.elementManager.addElement(mdfElement);
                console.log('✅ 저장된 MDF 로드 (보기 모드):', mdfElement);
            });
            
            // 저장된 AP 위치 맵 생성 (referenceId 기준)
            this.savedApPositions = {};
            
            // 모든 교실 요소 수집 (offset 계산을 위해)
            const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
            
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
                    
                    // 서버에서 받은 좌표는 절대 좌표(중앙 좌표)일 수 있으므로, 교실 기준 offset으로 변환 필요
                    // 먼저 해당 AP의 교실을 찾아야 함
                    let offsetX = 0;
                    let offsetY = 0;
                    
                    // AP의 classroomId 찾기 (wirelessAps에서 찾기)
                    let apClassroomId = null;
                    if (this.wirelessAps && this.wirelessAps.length > 0) {
                        const apInfo = this.wirelessAps.find(ap => ap.apId === apData.referenceId);
                        if (apInfo && apInfo.classroomId) {
                            apClassroomId = typeof apInfo.classroomId === 'string' 
                                ? parseInt(apInfo.classroomId, 10) 
                                : apInfo.classroomId;
                        }
                    }
                    
                    // wirelessAps에서 찾지 못한 경우 apData에서 직접 가져오기
                    if (!apClassroomId && apData.classroomId) {
                        apClassroomId = typeof apData.classroomId === 'string' 
                            ? parseInt(apData.classroomId, 10) 
                            : apData.classroomId;
                    }
                    
                    if (apClassroomId && apData.xCoordinate != null && apData.yCoordinate != null) {
                        // 교실 요소 찾기
                        const apRoom = allRooms.find(r => {
                            const rRefId = typeof r.referenceId === 'string' ? parseInt(r.referenceId, 10) : r.referenceId;
                            const rClassroomId = typeof r.classroomId === 'string' ? parseInt(r.classroomId, 10) : r.classroomId;
                            // 1. referenceId로 매칭
                            if (rRefId && rRefId === apClassroomId) return true;
                            // 2. classroomId로 매칭
                            if (rClassroomId && rClassroomId === apClassroomId) return true;
                            // 3. element_data에서 classroomId 확인
                            if (r.elementData) {
                                try {
                                    const elementData = typeof r.elementData === 'string' ? JSON.parse(r.elementData) : r.elementData;
                                    if (elementData) {
                                        const dataClassroomId = typeof elementData.classroomId === 'string' 
                                            ? parseInt(elementData.classroomId, 10) 
                                            : elementData.classroomId;
                                        if (dataClassroomId && dataClassroomId === apClassroomId) return true;
                                        // referenceId도 확인
                                        const dataRefId = typeof elementData.referenceId === 'string' 
                                            ? parseInt(elementData.referenceId, 10) 
                                            : elementData.referenceId;
                                        if (dataRefId && dataRefId === apClassroomId) return true;
                                    }
                                } catch (e) {}
                            }
                            return false;
                        });
                        
                        if (apRoom) {
                            // 절대 좌표(중앙)를 교실 기준 offset으로 변환
                            // 서버에 저장된 좌표는 중앙 좌표이므로, 교실의 좌상단 좌표를 빼서 offset 계산
                            offsetX = apData.xCoordinate - apRoom.xCoordinate;
                            offsetY = apData.yCoordinate - apRoom.yCoordinate;
                            console.log('🔄 절대 좌표를 offset으로 변환 (AP 보기 모드):', {
                                apId: apData.referenceId,
                                pageNumber: apRoom.pageNumber,
                                absoluteX: apData.xCoordinate,
                                absoluteY: apData.yCoordinate,
                                roomX: apRoom.xCoordinate,
                                roomY: apRoom.yCoordinate,
                                offsetX,
                                offsetY
                            });
                        } else {
                            // 교실을 찾지 못한 경우, 절대 좌표가 작으면 offset으로 간주
                            if (apData.xCoordinate < 5000 && apData.yCoordinate < 5000) {
                                offsetX = apData.xCoordinate;
                                offsetY = apData.yCoordinate;
                                console.log('⚠️ 교실을 찾지 못함, 작은 값이므로 offset으로 간주 (AP 보기 모드):', {
                                    apId: apData.referenceId,
                                    classroomId: apClassroomId,
                                    offsetX,
                                    offsetY
                                });
                            } else {
                                // 큰 값이면 절대 좌표일 가능성이 높지만, 교실을 찾지 못했으므로 기본값 사용
                                console.warn('⚠️ 교실을 찾지 못하고 좌표가 큼, 기본 offset 사용 (AP 보기 모드):', {
                                    apId: apData.referenceId,
                                    classroomId: apClassroomId,
                                    absoluteX: apData.xCoordinate,
                                    absoluteY: apData.yCoordinate
                                });
                            }
                        }
                    }
                    
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
            console.error('저장된 AP/MDF 로드 오류 (보기 모드):', error);
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
     * 무선AP 렌더링
     */
    renderWirelessAps(wirelessAps) {
        console.log('📡 무선AP 보기 모드 - 렌더링 시작:', wirelessAps.length, '개');
        
        // 현재 페이지 확인
        const currentPage = this.core.currentPage || 1;
        console.log('📄 현재 페이지:', currentPage);
        
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
            // 모든 페이지의 교실 검색 (AP는 교실이 있는 페이지에 표시되어야 함)
            if (!roomElement) {
                const allRooms = this.core.state.elements.filter(e => e.elementType === 'room');
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
            
            // 교실의 페이지 번호 확인
            const roomPage = roomElement.pageNumber != null ? roomElement.pageNumber : 1;
            const currentPage = this.core.currentPage || 1;
            
            // 현재 페이지의 교실에 속한 AP만 렌더링
            if (roomPage !== currentPage) {
                console.log('⏭️ 다른 페이지의 AP (스킵):', ap.apId, 'AP 페이지:', roomPage, '현재 페이지:', currentPage);
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
            let letterColor = '#000000'; // circle-l 기본 색상
            
            if (savedPosition) {
                backgroundColor = savedPosition.backgroundColor || backgroundColor;
                borderColor = savedPosition.borderColor || borderColor;
                shapeType = savedPosition.shapeType || 'circle';
                letterColor = savedPosition.letterColor || letterColor; // letterColor 추가
                
                // savedPosition.x, y는 교실 기준 상대 좌표(오프셋)
                const offsetX = savedPosition.x || 0;
                const offsetY = savedPosition.y || 0;
                
                if (shapeType === 'circle' || shapeType === 'circle-l') {
                    radius = savedPosition.radius || DEFAULT_RADIUS;
                    width = radius * 2;
                    height = radius * 2;
                } else {
                    width = savedPosition.width || DEFAULT_SIZE;
                    height = savedPosition.height || DEFAULT_SIZE;
                }
                
                // 교실 위치 + 상대 좌표 = 실제 중앙 좌표
                centerX = roomElement.xCoordinate + offsetX;
                centerY = roomElement.yCoordinate + offsetY;
                
                console.log('✅ 저장된 AP 위치 사용 (교실 기준):', ap.apId, {
                    shapeType,
                    offsetX,
                    offsetY,
                    centerX,
                    centerY,
                    width,
                    height,
                    letterColor
                });
            } else {
                // 기본 위치 (교실 중앙 살짝 아래) - 20px 아래로 이동
                shapeType = 'circle';
                const baseCenterX = roomElement.xCoordinate + roomElement.width / 2;
                const baseCenterY = roomElement.yCoordinate + roomElement.height / 2 + 30;
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
                letterColor: (shapeType === 'circle-l') ? letterColor : undefined, // circle-l일 때만 letterColor 추가
                borderWidth: 2,
                label: ap.newLabelNumber,
                pageNumber,
                zIndex: 1000,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(apElement);
            createdCount++;
            console.log('✅ AP 생성 완료 (보기 모드):', ap.apId, ap.newLabelNumber, '교실:', roomElement.label || roomElement.id, '페이지:', pageNumber);
        });
        
        console.log('✅ 무선AP 보기 모드 - 렌더링 완료: 생성', createdCount, '개, 스킵', skippedCount, '개');
        
        // 생성된 AP 요소 확인 및 페이지별 통계
        const allApElements = this.core.state.elements.filter(e => e.elementType === 'wireless_ap');
        console.log('📊 Core state의 무선AP 요소 개수:', allApElements.length);
        
        // 페이지별 AP 통계 로그
        const apByPage = {};
        const apByClassroom = {};
        allApElements.forEach(ap => {
            const page = ap.pageNumber || 1;
            if (!apByPage[page]) {
                apByPage[page] = [];
            }
            apByPage[page].push({
                apId: ap.referenceId,
                label: ap.label,
                classroomId: ap.parentElementId || ap.referenceId,
                elementId: ap.id
            });
            
            // 교실별 AP 중복 확인
            const classroomId = ap.parentElementId || ap.referenceId;
            if (classroomId) {
                if (!apByClassroom[classroomId]) {
                    apByClassroom[classroomId] = [];
                }
                apByClassroom[classroomId].push({
                    apId: ap.referenceId,
                    label: ap.label,
                    page: page,
                    elementId: ap.id
                });
            }
        });
        
        console.log('📄 페이지별 AP 통계 (보기 모드):');
        Object.keys(apByPage).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
            console.log(`  페이지 ${page}: ${apByPage[page].length}개 AP`, apByPage[page].map(ap => `${ap.label}(${ap.apId})`).join(', '));
        });
        
        // 교실별 중복 확인
        const duplicateClassrooms = Object.keys(apByClassroom).filter(classroomId => apByClassroom[classroomId].length > 1);
        if (duplicateClassrooms.length > 0) {
            console.warn('⚠️ 같은 교실에 여러 AP가 있는 경우:');
            duplicateClassrooms.forEach(classroomId => {
                console.warn(`  교실 ${classroomId}:`, apByClassroom[classroomId].map(ap => `${ap.label}(${ap.apId}) - 페이지 ${ap.page}`).join(', '));
            });
        } else {
            console.log('✅ 교실별 AP 중복 없음');
        }
        
        // 강제 렌더링
        this.core.markDirty();
        this.core.render && this.core.render();
    }
    
    /**
     * 네트워크 장비 렌더링
     */
    renderNetworkEquipments(equipments) {
        equipments.forEach(equipment => {
            const element = {
                type: 'network_equipment',
                referenceId: equipment.equipmentId,
                x: equipment.xCoordinate,
                y: equipment.yCoordinate,
                width: equipment.width || 50,
                height: equipment.height || 65,
                name: equipment.name,
                equipmentType: equipment.equipmentType,
                color: equipment.color || '#3b82f6',
                layerOrder: 900,
                isLocked: true // 읽기 전용
            };
            
            this.elementManager.addElement(element);
        });
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
            e.type === 'network_equipment' ||
            e.type === 'mdf_idf'
        );
        
        apElements.forEach(element => {
            this.elementManager.removeElement(element.id);
        });
    }
}

