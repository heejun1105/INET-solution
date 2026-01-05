/**
 * DataSyncManager.js
 * 서버 동기화 관리
 * 
 * 책임:
 * - 평면도 저장/로드
 * - 낙관적 업데이트
 * - 에러 처리/재시도
 * - 데이터 검증
 * - 버전 관리
 */

export default class DataSyncManager {
    /**
     * @param {FloorPlanCore} core - FloorPlanCore 인스턴스
     */
    constructor(core) {
        if (!core) {
            throw new Error('FloorPlanCore instance is required');
        }
        
        console.log('🔄 DataSyncManager 초기화 시작');
        
        this.core = core;
        
        // API 엔드포인트 (RESTful)
        this.apiBase = '/floorplan/api/schools';
        
        // 현재 학교 ID
        this.currentSchoolId = null;
        
        // 자동 저장 타이머
        this.autoSaveTimer = null;
        this.autoSaveDelay = 5000; // 5초
        
        // 재시도 설정
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1초
        
        console.log('✅ DataSyncManager 초기화 완료');
    }
    
    // ===== 저장/로드 =====
    
    /**
     * 평면도 저장
     * @param {Number} schoolId - 학교 ID
     * @param {Boolean} showNotification - 알림 표시 여부
     * @returns {Promise<Boolean>} 성공 여부
     */
    async save(schoolId = null, showNotification = true) {
        const targetSchoolId = schoolId || this.currentSchoolId;
        
        if (!targetSchoolId) {
            throw new Error('학교 ID가 필요합니다');
        }
        
        console.log('💾 평면도 저장 시작 - schoolId:', targetSchoolId);
        
        try {
            // 저장 중 플래그
            this.core.setState({ isSaving: true });
            
            // 데이터 검증
            this.validateBeforeSave();
            
            // 교실 설계 모드에서 AP 정보를 찾을 수 없는 경우, 서버에서 기존 AP 요소 로드
            await this.loadExistingApElementsIfNeeded(targetSchoolId);
            
            // 저장 데이터 준비
            const saveData = this.prepareSaveData();
            
            // 서버에 저장 (RESTful API)
            const response = await this.sendRequest(
                `${this.apiBase}/${targetSchoolId}`,
                'PUT',
                saveData
            );
            
            if (response.success) {
                console.log('✅ 평면도 저장 완료');
                
                if (showNotification) {
                    this.showNotification('평면도가 저장되었습니다.', 'success');
                }
                
                return { success: true, message: '저장 완료' };
            } else {
                const errorMessage = response.message || '평면도 저장에 실패했습니다.';
                console.error('❌ 평면도 저장 실패:', errorMessage);
                
                if (showNotification) {
                    this.showNotification('평면도 저장 중 오류가 발생했습니다.', 'error');
                }
                
                return { success: false, message: errorMessage };
            }
            
        } catch (error) {
            console.error('❌ 평면도 저장 실패:', error);
            
            const errorMessage = error.message || '평면도 저장 중 오류가 발생했습니다.';
            
            if (showNotification) {
                this.showNotification('평면도 저장 중 오류가 발생했습니다.', 'error');
            }
            
            // 예외를 던지지 않고 오류 객체 반환
            return { success: false, message: errorMessage };
            
        } finally {
            this.core.setState({ isSaving: false });
        }
    }
    
    /**
     * 평면도 로드
     * @param {Number} schoolId - 학교 ID
     * @returns {Promise<Boolean>} 성공 여부
     */
    async load(schoolId) {
        if (!schoolId) {
            throw new Error('학교 ID가 필요합니다');
        }
        
        console.log('📥 평면도 로드 시작 - schoolId:', schoolId);
        
        try {
            // 로딩 중 플래그
            this.core.setState({ isLoading: true });
            
            // 서버에서 로드 (RESTful API)
            const response = await this.sendRequest(
                `${this.apiBase}/${schoolId}`,
                'GET'
            );
            
            if (response.success) {
                // 데이터 적용
                this.applyLoadedData(response);
                
                // 현재 학교 ID 저장
                this.currentSchoolId = schoolId;
                
                console.log('✅ 평면도 로드 완료');
                
                this.showNotification('평면도를 불러왔습니다.', 'success');
                
                return true;
            } else {
                throw new Error(response.message || '평면도를 찾을 수 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 평면도 로드 실패:', error);
            
            // 404 에러는 조용히 처리 (새로운 평면도)
            if (error.status === 404) {
                console.log('ℹ️ 새로운 평면도 생성');
                this.currentSchoolId = schoolId;
                return false;
            }
            
            this.showNotification('평면도 로드 중 오류가 발생했습니다.', 'error');
            
            throw error;
            
        } finally {
            this.core.setState({ isLoading: false });
        }
    }
    
    /**
     * 평면도 존재 여부 확인
     * @param {Number} schoolId - 학교 ID
     * @returns {Promise<Boolean>} 존재 여부
     */
    async exists(schoolId) {
        if (!schoolId) {
            throw new Error('학교 ID가 필요합니다');
        }
        
        try {
            const response = await this.sendRequest(
                `${this.apiBase}/${schoolId}/exists`,
                'GET'
            );
            
            return response.exists || false;
            
        } catch (error) {
            console.error('❌ 평면도 존재 확인 실패:', error);
            return false;
        }
    }
    
    /**
     * 평면도 삭제
     * @param {Number} schoolId - 학교 ID
     * @returns {Promise<Boolean>} 성공 여부
     */
    async delete(schoolId = null) {
        const targetSchoolId = schoolId || this.currentSchoolId;
        
        if (!targetSchoolId) {
            throw new Error('학교 ID가 필요합니다');
        }
        
        console.log('🗑️ 평면도 삭제 시작 - schoolId:', targetSchoolId);
        
        try {
            const confirmed = confirm('정말 평면도를 삭제하시겠습니까?');
            if (!confirmed) {
                return false;
            }
            
            const response = await this.sendRequest(
                `${this.apiBase}/${targetSchoolId}`,
                'DELETE'
            );
            
            if (response.success) {
                // 로컬 데이터 초기화
                this.core.setState({
                    elements: [],
                    selectedElements: []
                });
                
                console.log('✅ 평면도 삭제 완료');
                
                this.showNotification('평면도가 삭제되었습니다.', 'success');
                
                return true;
            } else {
                throw new Error(response.message || '평면도 삭제에 실패했습니다.');
            }
            
        } catch (error) {
            console.error('❌ 평면도 삭제 실패:', error);
            
            this.showNotification('평면도 삭제 중 오류가 발생했습니다.', 'error');
            
            throw error;
        }
    }
    
    // ===== 자동 저장 =====
    
    /**
     * 자동 저장 활성화
     */
    enableAutoSave() {
        console.log('⏰ 자동 저장 활성화');
        
        // 이미 활성화되어 있으면 무시
        if (this.autoSaveTimer) {
            return;
        }
        
        // 상태 변경 시 자동 저장 예약
        const originalSetState = this.core.setState.bind(this.core);
        this.core.setState = (updates) => {
            originalSetState(updates);
            this.scheduleAutoSave();
        };
    }
    
    /**
     * 자동 저장 비활성화
     */
    disableAutoSave() {
        console.log('⏰ 자동 저장 비활성화');
        
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    /**
     * 자동 저장 예약
     */
    scheduleAutoSave() {
        // 기존 타이머 취소
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        // 새 타이머 설정
        this.autoSaveTimer = setTimeout(() => {
            if (this.currentSchoolId) {
                this.save(this.currentSchoolId, false).catch(error => {
                    console.error('자동 저장 실패:', error);
                });
            }
        }, this.autoSaveDelay);
    }
    
    // ===== 데이터 준비 =====
    
    /**
     * 요소를 저장 형식으로 준비
     * @param {Object} element - 저장할 요소
     * @param {number} currentPage - 현재 페이지 번호
     * @returns {Object|null} - 준비된 요소 데이터 또는 null
     */
    prepareElementForSave(element, currentPage) {
        if (!element || (!element.id && !element.elementType)) return null;
        
            const elementData = { ...element };
        
        // elementData 필드가 문자열이면 파싱해서 병합 (AP 요소의 경우)
        if (elementData.elementData && typeof elementData.elementData === 'string') {
            try {
                const parsedElementData = JSON.parse(elementData.elementData);
                // 파싱된 데이터를 elementData에 병합 (기존 필드보다 우선)
                Object.assign(elementData, parsedElementData);
                // elementData 필드 제거 (서버로 전송 시 중복 방지)
                delete elementData.elementData;
            } catch (e) {
                console.warn('elementData 파싱 실패:', e);
            }
        }
        
        // 페이지 번호가 없으면 현재 페이지로 설정
        if (!elementData.pageNumber && (elementData.id || elementData.elementType)) {
            elementData.pageNumber = currentPage;
        }
            
            // temp로 시작하는 ID는 null로 설정
            if (elementData.id && elementData.id.toString().startsWith('temp')) {
                elementData.id = null;
            }
            
            // parentElementId를 parentId로 변환 (백엔드 호환)
            if (elementData.parentElementId) {
                elementData.parentId = elementData.parentElementId;
            }
            
            // wireless_ap 요소의 경우: 좌상단 좌표를 중앙 좌표로 변환하여 저장 (모양별 처리)
            if (elementData.elementType === 'wireless_ap') {
                const shapeType = elementData.shapeType || 'circle';
                
            if (shapeType === 'circle' || shapeType === 'circle-l') {
                // circle과 circle-l은 원형 처리
                    // radius가 이미 설정되어 있으면 그대로 사용 (재계산하지 않음)
                    // radius가 없으면 width/2를 사용하되, width도 재계산하지 않음
                    let radius = elementData.radius;
                    if (radius == null) {
                        // radius가 없으면 width/2를 사용
                        radius = elementData.width ? elementData.width / 2 : 20;
                    }
                    const left = elementData.xCoordinate ?? 0;
                    const top = elementData.yCoordinate ?? 0;
                    elementData.radius = radius;
                    // width와 height는 radius * 2로 설정 (일관성 유지)
                    elementData.width = radius * 2;
                    elementData.height = radius * 2;
                    elementData.xCoordinate = left + radius;
                    elementData.yCoordinate = top + radius;
                } else {
                    const width = elementData.width || 40;
                    const height = elementData.height || 40;
                    const left = elementData.xCoordinate ?? 0;
                    const top = elementData.yCoordinate ?? 0;
                // radius 필드 제거 (null 대신 필드 자체를 제거하여 JSON 변환 시 문제 방지)
                delete elementData.radius;
                    elementData.width = width;
                    elementData.height = height;
                    elementData.xCoordinate = left + width / 2;
                    elementData.yCoordinate = top + height / 2;
                }
            }
        
        // null 값 제거 (서버로 전송 시 JSON 변환 문제 방지)
        Object.keys(elementData).forEach(key => {
            if (elementData[key] === null || elementData[key] === undefined) {
                delete elementData[key];
            }
        });
            
            return elementData;
    }
    
    /**
     * 저장 데이터 준비
     */
    prepareSaveData() {
        const { elements, canvasWidth, canvasHeight, zoom, panX, panY, gridSize, showGrid, snapToGrid } = this.core.state;
        
        // 현재 페이지 번호 가져오기 (FloorPlanApp에서 설정된 값)
        const currentPage = this.core.currentPage || window.floorPlanApp?.currentPage || 1;
        
        // 모든 요소를 저장하되, 각 요소의 pageNumber는 그대로 유지
        // (백엔드는 currentPage에 해당하는 요소만 먼저 지우고, 전체 elements를 병합 저장)
        const allElements = (elements || []).map(element => {
            return this.prepareElementForSave(element, currentPage);
        }).filter(Boolean);
        
        // savedApPositions에서 AP 요소 생성하여 추가 (교실 설계 모드에서도 AP 위치 정보 저장)
        // window.floorPlanApp.savedApPositions에 저장된 AP 위치 정보를 서버에 저장
        if (window.floorPlanApp && window.floorPlanApp.savedApPositions) {
            const savedApPositions = window.floorPlanApp.savedApPositions;
            const wirelessAps = window.floorPlanApp.modeManager?.wirelessAps || [];
            
            // 모든 교실 요소 찾기 (모든 페이지)
            const allRooms = elements.filter(el => el.elementType === 'room');
            
            // savedApPositions의 각 AP에 대해 요소 생성
            Object.keys(savedApPositions).forEach(apId => {
                const apPosition = savedApPositions[apId];
                if (!apPosition) return;
                
                // AP 정보 찾기 (wirelessAps에서 또는 서버에 이미 저장된 AP 데이터에서)
                let apInfo = wirelessAps.find(ap => String(ap.apId) === apId);
                let classroomId = null;
                
                if (apInfo && apInfo.classroomId) {
                    // wirelessAps에서 찾은 경우
                    classroomId = String(apInfo.classroomId);
                } else {
                    // wirelessAps가 없거나 AP를 찾지 못한 경우
                    // 1. savedApPositions에 classroomId가 저장되어 있는지 확인
                    if (apPosition.classroomId) {
                        classroomId = String(apPosition.classroomId);
                        console.log('✅ savedApPositions에서 classroomId 찾음:', {
                            apId,
                            classroomId
                        });
                    } else {
                        // 2. 서버에 이미 저장된 AP 데이터에서 찾기
                        // 먼저 core.state.elements에서 찾기 (loadExistingApElementsIfNeeded에서 추가한 AP 요소)
                        let stateAp = this.core.state.elements.find(el => 
                            el.elementType === 'wireless_ap' && 
                            el.referenceId === parseInt(apId, 10)
                        );
                        
                        if (stateAp && stateAp.elementData) {
                            try {
                                const elementData = typeof stateAp.elementData === 'string' 
                                    ? JSON.parse(stateAp.elementData) 
                                    : stateAp.elementData;
                                if (elementData && elementData.classroomId) {
                                    classroomId = String(elementData.classroomId);
                                    console.log('✅ core.state.elements AP elementData에서 classroomId 찾음:', {
                                        apId,
                                        classroomId
                                    });
                                }
                            } catch (e) {
                                console.warn('⚠️ core.state.elements AP elementData 파싱 실패:', e);
                            }
                        }
                        
                        // 2-1. core.state.elements에서 찾지 못한 경우, allElements에서 찾기
                        if (!classroomId) {
                            const existingAp = allElements.find(el => 
                                el.elementType === 'wireless_ap' && 
                                el.referenceId === parseInt(apId, 10)
                            );
                            
                            if (existingAp) {
                                // 기존 AP 요소에서 classroomId 찾기
                                if (existingAp.elementData) {
                                    try {
                                        const elementData = typeof existingAp.elementData === 'string' 
                                            ? JSON.parse(existingAp.elementData) 
                                            : existingAp.elementData;
                                        if (elementData && elementData.classroomId) {
                                            classroomId = String(elementData.classroomId);
                                            console.log('✅ AP elementData에서 classroomId 찾음:', {
                                                apId,
                                                classroomId
                                            });
                                        }
                                    } catch (e) {
                                        console.warn('⚠️ AP elementData 파싱 실패:', e);
                                    }
                                }
                            }
                        }
                        
                        // 2-2. 여전히 찾지 못한 경우, referenceId를 classroomId로 사용하지 않고 경고
                        if (!classroomId) {
                            console.warn('⚠️ AP의 classroomId를 찾을 수 없음 (저장 건너뜀):', {
                                apId,
                                wirelessApsCount: wirelessAps.length,
                                hasStateAp: !!stateAp,
                                stateApElementData: stateAp?.elementData,
                                hasExistingAp: !!allElements.find(el => 
                                    el.elementType === 'wireless_ap' && 
                                    el.referenceId === parseInt(apId, 10)
                                ),
                                allElementsCount: allElements.length,
                                apElementsInAllElements: allElements.filter(el => el.elementType === 'wireless_ap').length,
                                coreStateApCount: this.core.state.elements.filter(el => el.elementType === 'wireless_ap').length
                            });
                            return;
                        }
                    }
                }
                
                if (!classroomId) return;
                
                // 교실 요소 찾기
                let roomElement = allRooms.find(room => {
                    const roomRefId = room.referenceId ? String(room.referenceId) : null;
                    const roomClassroomId = room.classroomId ? String(room.classroomId) : null;
                    return (roomRefId === classroomId) || (roomClassroomId === classroomId);
                });
                
                if (!roomElement) {
                    // element_data에서도 확인
                    roomElement = allRooms.find(room => {
                        if (room.elementData) {
                            try {
                                const elementData = typeof room.elementData === 'string' 
                                    ? JSON.parse(room.elementData) 
                                    : room.elementData;
                                if (elementData) {
                                    const dataRefId = elementData.referenceId ? String(elementData.referenceId) : null;
                                    const dataClassroomId = elementData.classroomId ? String(elementData.classroomId) : null;
                                    return (dataRefId === classroomId) || (dataClassroomId === classroomId);
                                }
                            } catch (e) {}
                        }
                        return false;
                    });
                }
                
                if (!roomElement) {
                    console.warn('⚠️ AP의 교실을 찾을 수 없음 (저장 건너뜀):', {
                        apId,
                        classroomId,
                        availableRooms: allRooms.map(r => ({
                            refId: r.referenceId,
                            classroomId: r.classroomId,
                            pageNumber: r.pageNumber
                        }))
                    });
                    return;
                }
                
                // 교실의 현재 좌표 (새로운 좌표일 수 있음)
                const roomX = roomElement.xCoordinate || 0;
                const roomY = roomElement.yCoordinate || 0;
                
                // savedApPositions의 offset을 직접 사용 (모드에 관계없이 일관된 동작)
                // AP 설계 모드에서 드래그한 최신 위치가 savedApPositions에 저장되어 있으므로,
                // 항상 이 값을 사용하여 일관성을 유지
                const offsetX = apPosition.x || 0;
                const offsetY = apPosition.y || 0;
                const centerX = roomX + offsetX;
                const centerY = roomY + offsetY;
                
                console.log('💾 savedApPositions의 offset 직접 사용:', {
                    apId,
                    offsetX: offsetX.toFixed(2),
                    offsetY: offsetY.toFixed(2),
                    roomX: roomX.toFixed(2),
                    roomY: roomY.toFixed(2),
                    centerX: centerX.toFixed(2),
                    centerY: centerY.toFixed(2)
                });
                
                // AP 요소 생성
                const shapeType = apPosition.shapeType || 'circle';
                const width = apPosition.width || 40;
                const height = apPosition.height || 40;
                const radius = (shapeType === 'circle' || shapeType === 'circle-l') 
                    ? (apPosition.radius || width / 2) 
                    : null;
                
                // prepareElementForSave에 전달할 좌표 계산
                // prepareElementForSave는 좌상단 좌표를 중앙 좌표로 변환하므로,
                // 이미 중앙 좌표인 경우 좌상단 좌표로 변환해서 전달해야 함
                let leftX, topY;
                if (shapeType === 'circle' || shapeType === 'circle-l') {
                    // 원형: 중앙 좌표에서 반지름을 빼서 좌상단 좌표 계산
                    leftX = centerX - radius;
                    topY = centerY - radius;
                } else {
                    // 다른 모양: 중앙 좌표에서 width/2, height/2를 빼서 좌상단 좌표 계산
                    leftX = centerX - width / 2;
                    topY = centerY - height / 2;
                }
                
                const apElement = {
                    elementType: 'wireless_ap',
                    referenceId: parseInt(apId, 10),
                    pageNumber: roomElement.pageNumber || currentPage,
                    xCoordinate: leftX,  // 좌상단 좌표 (prepareElementForSave에서 중앙으로 변환됨)
                    yCoordinate: topY,  // 좌상단 좌표 (prepareElementForSave에서 중앙으로 변환됨)
                    // 이미 중앙 좌표로 변환되었음을 표시하는 플래그 추가
                    _isCenterCoordinate: false,  // prepareElementForSave에서 변환 필요
                    width: width,
                    height: height,
                    radius: radius,
                    shapeType: shapeType,
                    backgroundColor: apPosition.backgroundColor || '#3b82f6',
                    borderColor: apPosition.borderColor || '#1e40af',
                    letterColor: apPosition.letterColor || '#000000',
                    borderWidth: 2,
                    zIndex: 800,
                    // elementData에 shapeType 등 명시적으로 포함 (서버 저장용)
                    // offsetX, offsetY는 재계산된 값 사용 (교실 위치 변경 반영)
                    elementData: JSON.stringify({
                        shapeType: shapeType,
                        backgroundColor: apPosition.backgroundColor || '#3b82f6',
                        borderColor: apPosition.borderColor || '#1e40af',
                        letterColor: apPosition.letterColor || '#000000',
                        width: width,
                        height: height,
                        radius: radius,
                        offsetX: offsetX,  // 재계산된 offset 사용
                        offsetY: offsetY  // 재계산된 offset 사용
                    })
                };
                
                console.log('🔍 AP 요소 생성 (savedApPositions):', {
                    apId,
                    roomX: roomX.toFixed(2),
                    roomY: roomY.toFixed(2),
                    offsetX: offsetX.toFixed(2),
                    offsetY: offsetY.toFixed(2),
                    centerX: centerX.toFixed(2),
                    centerY: centerY.toFixed(2),
                    leftX: leftX.toFixed(2),
                    topY: topY.toFixed(2),
                    shapeType
                });
                
                // prepareElementForSave를 통해 처리 (elementData 파싱 및 좌표 변환 등)
                const preparedApElement = this.prepareElementForSave(apElement, currentPage);
                if (!preparedApElement) {
                    console.warn('⚠️ AP 요소 준비 실패 (저장 건너뜀):', apId);
                    return;
                }
                
                console.log('🔍 AP 요소 prepareElementForSave 후:', {
                    apId,
                    변환전_xCoordinate: leftX.toFixed(2),
                    변환전_yCoordinate: topY.toFixed(2),
                    변환후_xCoordinate: preparedApElement.xCoordinate?.toFixed(2),
                    변환후_yCoordinate: preparedApElement.yCoordinate?.toFixed(2),
                    width: preparedApElement.width,
                    height: preparedApElement.height,
                    radius: preparedApElement.radius,
                    shapeType: preparedApElement.shapeType
                });
                
                // 이미 allElements에 같은 referenceId를 가진 AP가 있는지 확인
                const existingApIndex = allElements.findIndex(el => 
                    el.elementType === 'wireless_ap' && 
                    el.referenceId === parseInt(apId, 10)
                );
                
                if (existingApIndex >= 0) {
                    // 기존 AP 요소 업데이트
                    allElements[existingApIndex] = { ...allElements[existingApIndex], ...preparedApElement };
                    console.log('🔄 기존 AP 요소 업데이트 (savedApPositions):', {
                        apId,
                        pageNumber: preparedApElement.pageNumber,
                        shapeType: preparedApElement.shapeType,
                        최종_xCoordinate: preparedApElement.xCoordinate?.toFixed(2),
                        최종_yCoordinate: preparedApElement.yCoordinate?.toFixed(2),
                        원래_centerX: centerX.toFixed(2),
                        원래_centerY: centerY.toFixed(2)
                    });
                } else {
                    // 새 AP 요소 추가
                    allElements.push(preparedApElement);
                    console.log('➕ 새 AP 요소 추가 (savedApPositions):', {
                        apId,
                        pageNumber: preparedApElement.pageNumber,
                        shapeType: preparedApElement.shapeType,
                        최종_xCoordinate: preparedApElement.xCoordinate?.toFixed(2),
                        최종_yCoordinate: preparedApElement.yCoordinate?.toFixed(2),
                        원래_centerX: centerX.toFixed(2),
                        원래_centerY: centerY.toFixed(2)
                    });
                }
            });
        }
        
        console.log('💾 저장할 요소들:', allElements.map(el => ({
            type: el.elementType,
            label: el.label,
            referenceId: el.referenceId,
            parentElementId: el.parentElementId,
            parentId: el.parentId
        })));
        
        return {
            canvasWidth,
            canvasHeight,
            zoomLevel: zoom,
            panX,
            panY,
            gridSize,
            showGrid,
            snapToGrid,
            // 현재 저장 중인 페이지 (백엔드에서 페이지 단위 병합에 사용)
            currentPage,
            elements: allElements  // 모든 요소를 elements 배열로 저장
        };
    }
    
    /**
     * 로드된 데이터 적용
     */
    applyLoadedData(response) {
        console.log('📥 평면도 데이터 적용 시작:', response);
        
        // 응답이 래핑되어 있는 경우 처리 (response.data.floorPlan)
        const data = response.data || response;
        const { floorPlan, elements } = data;
        
        console.log('📥 추출된 데이터:', { floorPlan, elements: elements?.length });
        
        if (!floorPlan || !elements || !Array.isArray(elements)) {
            console.warn('⚠️ 평면도 데이터가 비어있습니다', { floorPlan, elements });
            return;
        }
        
        // 메타데이터 적용
        this.core.setState({
            canvasWidth: 16000,  // 캔버스 크기 적용
            canvasHeight: 12000,  // 캔버스 크기 적용
            zoom: floorPlan.zoomLevel || 1.0,
            panX: floorPlan.panX || 0,
            panY: floorPlan.panY || 0,
            gridSize: floorPlan.gridSize || 20,
            showGrid: floorPlan.showGrid !== false,
            snapToGrid: floorPlan.snapToGrid !== false
        });
        
        // 1단계: ID 매핑 테이블 생성 (백엔드 ID -> 프론트엔드 ID)
        const idMap = new Map();
        elements.forEach(el => {
            if (el.id) {
                // 백엔드 ID를 키로, 프론트엔드 ID를 값으로 저장
                idMap.set(el.id, el.id);
            }
        });
        
        console.log('🗺️ ID 매핑 테이블:', Array.from(idMap.entries()));
        
        // 2단계: 요소들 적용
        // wireless_ap, mdf_idf, seat_layout 요소는 제외
        // - wireless_ap, mdf_idf: 무선AP 설계 모드에서 동적으로 생성/저장되므로 여기서는 로드하지 않음
        // - seat_layout: 자리 배치 모달에서 별도로 관리되므로 메인 캔버스에 로드하지 않음
        const filteredElements = elements.filter(el => {
            if (el.elementType === 'wireless_ap') {
                console.log('⏭️ wireless_ap 요소 제외 (무선AP 모드에서 별도 로드):', el.referenceId);
                return false;
            }
            if (el.elementType === 'mdf_idf') {
                console.log('⏭️ mdf_idf 요소 제외 (무선AP 모드에서 별도 로드):', el.id);
                return false;
            }
            if (el.elementType === 'seat_layout') {
                console.log('⏭️ seat_layout 요소 제외 (자리 배치 모달에서 별도 로드):', el.referenceId);
                return false;
            }
            return true;
        });
        
        const loadedElements = filteredElements.map(el => {
            // ID가 없으면 임시 ID 생성
            if (!el.id) {
                el.id = `temp_${Date.now()}_${Math.random()}`;
            }
            
            // room 타입 요소의 경우 referenceId를 classroomId에 복사 (없으면)
            if (el.elementType === 'room') {
                if (!el.classroomId && el.referenceId) {
                    el.classroomId = el.referenceId;
                    console.log('🔄 교실 ID 복사 (referenceId → classroomId):', { 
                        elementId: el.id, 
                        label: el.label,
                        referenceId: el.referenceId, 
                        classroomId: el.classroomId 
                    });
                } else if (el.classroomId) {
                    console.log('✅ 교실 ID 이미 있음:', { 
                        elementId: el.id, 
                        label: el.label,
                        classroomId: el.classroomId 
                    });
                } else {
                    console.warn('⚠️ 교실 ID 없음:', { 
                        elementId: el.id, 
                        label: el.label,
                        referenceId: el.referenceId 
                    });
                }
            }
            
            // parentId를 parentElementId로 변환 및 매핑
            if (el.parentId) {
                // ID 매핑 테이블에서 실제 부모 ID 찾기
                const mappedParentId = idMap.get(el.parentId) || el.parentId;
                el.parentElementId = mappedParentId;
                console.log('🔄 부모 ID 매핑:', { 
                    elementId: el.id, 
                    label: el.label,
                    원본_parentId: el.parentId, 
                    매핑된_parentElementId: el.parentElementId 
                });
            }
            
            return el;
        });
        
        console.log('📊 로드된 요소들:', loadedElements.map(el => ({
            id: el.id,
            type: el.elementType,
            label: el.label,
            referenceId: el.referenceId,
            classroomId: el.classroomId
        })));
        
        // 현재 페이지의 요소만 필터링 (페이지별 로드 시)
        // 중복 방지: pageNumber가 null/undefined인 요소와 pageNumber === 1인 요소가 중복되지 않도록 처리
        const currentPage = this.core.currentPage || window.floorPlanApp?.currentPage || 1;
        const seenElementIds = new Set();
        const filteredByPage = loadedElements.filter(el => {
            // 중복 체크: 같은 ID의 요소가 이미 포함되었는지 확인
            const elementId = el.id ? el.id.toString() : `${el.elementType}_${el.xCoordinate}_${el.yCoordinate}`;
            if (seenElementIds.has(elementId)) {
                console.warn(`⚠️ 중복 요소 제거 (DataSyncManager): ${elementId}`);
                return false;
            }
            
            const elPage = el.pageNumber;
            // pageNumber가 null/undefined이면 1페이지로 간주
            const normalizedPage = (elPage === null || elPage === undefined) ? 1 : elPage;
            
            // 현재 페이지와 일치하는 것만 포함
            if (normalizedPage === currentPage) {
                seenElementIds.add(elementId);
                return true;
            }
            return false;
        });
        
        console.log(`📄 페이지 필터링: 전체 ${loadedElements.length}개 → 페이지 ${currentPage} ${filteredByPage.length}개`);
        
        this.core.setElements(filteredByPage);
        
        // 로드 후 검증
        this.validateAfterLoad();
        
        console.log('✅ 평면도 로드 완료:', {
            요소수: loadedElements.length,
            캔버스크기: `${floorPlan.canvasWidth}x${floorPlan.canvasHeight}`,
            줌: floorPlan.zoomLevel
        });
    }
    
    /**
     * 교실 설계 모드에서 AP 정보를 찾을 수 없는 경우, 서버에서 기존 AP 요소 로드
     * @param {Number} schoolId - 학교 ID
     */
    async loadExistingApElementsIfNeeded(schoolId) {
        console.log('🔍 loadExistingApElementsIfNeeded 호출:', {
            hasWindow: !!window.floorPlanApp,
            hasSavedApPositions: !!(window.floorPlanApp && window.floorPlanApp.savedApPositions),
            savedApPositionsCount: window.floorPlanApp?.savedApPositions ? Object.keys(window.floorPlanApp.savedApPositions).length : 0,
            wirelessApsCount: window.floorPlanApp?.modeManager?.wirelessAps?.length || 0,
            existingApElementsCount: this.core.state.elements.filter(el => el.elementType === 'wireless_ap').length
        });
        
        // wirelessAps가 비어있고, 현재 elements에 AP 요소가 없는 경우 서버에서 로드
        const wirelessAps = window.floorPlanApp?.modeManager?.wirelessAps || [];
        const existingApElements = this.core.state.elements.filter(el => el.elementType === 'wireless_ap');
        
        // wirelessAps가 비어있거나, AP 요소에 classroomId가 없는 경우 처리
        if (wirelessAps.length === 0) {
            // AP 정보 조회 (classroomId를 얻기 위해)
            let apInfoMap = {};
            try {
                const apiUrl = `${this.apiBase}/${schoolId}/wireless-aps`;
                console.log(`📥 AP 정보 조회 시작: ${apiUrl}`);
                const apInfoResponse = await this.sendRequest(
                    `${this.apiBase}/${schoolId}/wireless-aps`,
                    'GET'
                );
                console.log(`📥 AP 정보 조회 응답:`, apInfoResponse);
                if (apInfoResponse.success) {
                    // 응답 형식 확인: data.wirelessAps 또는 data 또는 직접 배열
                    let apList = [];
                    if (apInfoResponse.data) {
                        if (Array.isArray(apInfoResponse.data)) {
                            apList = apInfoResponse.data;
                        } else if (apInfoResponse.data.wirelessAps) {
                            apList = apInfoResponse.data.wirelessAps;
                        } else if (Array.isArray(apInfoResponse.data)) {
                            apList = apInfoResponse.data;
                        }
                    } else if (Array.isArray(apInfoResponse.wirelessAps)) {
                        apList = apInfoResponse.wirelessAps;
                    } else if (Array.isArray(apInfoResponse)) {
                        apList = apInfoResponse;
                    }
                    
                    console.log(`📥 AP 정보 리스트 (형식 확인):`, {
                        isArray: Array.isArray(apList),
                        length: apList.length,
                        firstItem: apList[0],
                        responseKeys: Object.keys(apInfoResponse),
                        dataKeys: apInfoResponse.data ? Object.keys(apInfoResponse.data) : null
                    });
                    
                    apList.forEach(ap => {
                        if (ap.apId) {
                            apInfoMap[String(ap.apId)] = ap;
                        }
                    });
                    console.log(`📥 AP 정보 ${Object.keys(apInfoMap).length}개 조회됨`);
                } else {
                    console.warn('⚠️ AP 정보 조회 실패 (success=false):', apInfoResponse);
                }
            } catch (e) {
                console.warn('⚠️ AP 정보 조회 실패 (계속 진행):', e);
            }
            
            // AP 요소가 없으면 서버에서 로드
            if (existingApElements.length === 0) {
                console.log('📥 교실 설계 모드: 서버에서 기존 AP 요소 로드 시작 (wirelessAps 비어있음)');
                
                try {
                    // 서버에서 전체 평면도 로드
                    const response = await this.sendRequest(
                        `${this.apiBase}/${schoolId}`,
                        'GET'
                    );
                    
                    if (response.success && response.data && response.data.elements) {
                        // AP 요소만 필터링
                        const apElements = response.data.elements.filter(el => el.elementType === 'wireless_ap');
                        
                        if (apElements.length > 0) {
                            console.log(`📥 서버에서 ${apElements.length}개의 AP 요소 로드됨`);
                            console.log(`📥 AP 요소 referenceId 목록:`, apElements.map(el => el.referenceId));
                            
                            // AP 요소들을 core.state.elements 형식으로 변환하여 임시 추가
                            const convertedApElements = apElements.map(apEl => {
                                // ID가 없으면 임시 ID 생성
                                if (!apEl.id) {
                                    apEl.id = `temp_ap_${apEl.referenceId}_${Date.now()}`;
                                }
                                
                                // elementData 파싱
                                if (apEl.elementData && typeof apEl.elementData === 'string') {
                                    try {
                                        apEl.elementData = JSON.parse(apEl.elementData);
                                    } catch (e) {
                                        console.warn('⚠️ AP elementData 파싱 실패:', e);
                                    }
                                }
                                
                                // AP 정보에서 classroomId 가져와서 elementData에 추가
                                if (apEl.referenceId && apInfoMap[String(apEl.referenceId)]) {
                                    const apInfo = apInfoMap[String(apEl.referenceId)];
                                    if (apInfo.classroomId) {
                                        if (!apEl.elementData) {
                                            apEl.elementData = {};
                                        } else if (typeof apEl.elementData === 'string') {
                                            try {
                                                apEl.elementData = JSON.parse(apEl.elementData);
                                            } catch (e) {
                                                apEl.elementData = {};
                                            }
                                        }
                                        apEl.elementData.classroomId = apInfo.classroomId;
                                        console.log(`✅ AP ${apEl.referenceId}의 classroomId 추가: ${apInfo.classroomId}`);
                                    }
                                }
                                
                                return apEl;
                            });
                            
                            // 현재 elements에 AP 요소 추가 (임시로, 저장 시에만 사용)
                            const currentElements = [...this.core.state.elements];
                            const updatedElements = [...currentElements, ...convertedApElements];
                            this.core.setState({ elements: updatedElements });
                            
                            console.log(`✅ ${convertedApElements.length}개의 AP 요소를 임시로 추가 (저장 시 사용)`);
                        } else {
                            console.log('ℹ️ 서버에 저장된 AP 요소가 없음');
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ 서버에서 AP 요소 로드 실패 (계속 진행):', error);
                    // 로드 실패해도 저장은 계속 진행
                }
            } else {
                // AP 요소는 있지만 classroomId가 없는 경우, 기존 요소에 classroomId 추가
                console.log('📥 기존 AP 요소에 classroomId 추가 시작');
                let updatedCount = 0;
                
                existingApElements.forEach(apEl => {
                    // elementData 확인
                    let elementData = null;
                    if (apEl.elementData) {
                        if (typeof apEl.elementData === 'string') {
                            try {
                                elementData = JSON.parse(apEl.elementData);
                            } catch (e) {
                                console.warn('⚠️ AP elementData 파싱 실패:', e);
                                elementData = {};
                            }
                        } else {
                            elementData = apEl.elementData;
                        }
                    } else {
                        elementData = {};
                    }
                    
                    // classroomId가 없으면 AP 정보에서 가져오기
                    if (!elementData.classroomId && apEl.referenceId && apInfoMap[String(apEl.referenceId)]) {
                        const apInfo = apInfoMap[String(apEl.referenceId)];
                        if (apInfo.classroomId) {
                            elementData.classroomId = apInfo.classroomId;
                            apEl.elementData = elementData;
                            updatedCount++;
                            console.log(`✅ AP ${apEl.referenceId}의 classroomId 추가: ${apInfo.classroomId}`);
                        }
                    }
                });
                
                if (updatedCount > 0) {
                    console.log(`✅ ${updatedCount}개의 기존 AP 요소에 classroomId 추가됨`);
                    // 상태 업데이트 (변경사항 반영)
                    this.core.setState({ elements: [...this.core.state.elements] });
                } else {
                    console.log('ℹ️ classroomId 추가할 AP 요소 없음');
                }
            }
        } else {
            console.log(`ℹ️ AP 요소 로드 건너뜀: wirelessAps=${wirelessAps.length}, existingApElements=${existingApElements.length}`);
        }
    }
    
    // ===== 검증 =====
    
    /**
     * 저장 전 검증
     */
    validateBeforeSave() {
        const { elements } = this.core.state;
        
        // 각 요소 검증
        for (const element of elements) {
            // 필수 필드 확인
            if (element.xCoordinate == null || element.yCoordinate == null) {
                throw new Error(`요소의 좌표가 유효하지 않습니다: ${element.id}`);
            }
            
            // 좌표 범위 확인
            if (element.xCoordinate < 0 || element.yCoordinate < 0) {
                console.warn('⚠️ 음수 좌표 발견:', element.id);
            }
        }
        
        console.debug('✓ 저장 전 검증 완료');
    }
    
    /**
     * 로드 후 검증
     */
    validateAfterLoad() {
        const { elements } = this.core.state;
        
        // 중복 ID 확인
        const ids = new Set();
        for (const element of elements) {
            if (ids.has(element.id)) {
                console.warn('⚠️ 중복 ID 발견:', element.id);
            }
            ids.add(element.id);
        }
        
        // 부모-자식 관계 검증
        const parentIds = new Set(elements.map(el => el.id));
        for (const element of elements) {
            if (element.parentElementId) {
                if (!parentIds.has(element.parentElementId)) {
                    console.warn('⚠️ 유효하지 않은 부모 ID:', {
                        elementId: element.id,
                        label: element.label,
                        parentElementId: element.parentElementId,
                        존재하는_부모: Array.from(parentIds)
                    });
                } else {
                    console.log('✓ 부모-자식 관계 확인:', {
                        자식: element.label,
                        자식_ID: element.id,
                        부모_ID: element.parentElementId
                    });
                }
            }
        }
        
        console.debug('✓ 로드 후 검증 완료');
    }
    
    // ===== HTTP 요청 =====
    
    /**
     * HTTP 요청 전송 (재시도 로직 포함)
     * @param {String} url - 요청 URL
     * @param {String} method - HTTP 메서드
     * @param {Object} data - 요청 데이터
     * @param {Number} retryCount - 재시도 횟수
     * @returns {Promise<Object>} 응답 데이터
     */
    async sendRequest(url, method = 'GET', data = null, retryCount = 0) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            
            // HTTP 상태 확인
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                throw error;
            }
            
            const result = await response.json();
            
            return result;
            
        } catch (error) {
            console.error('HTTP 요청 실패:', error);
            
            // 404 (Not Found)나 4xx 클라이언트 에러는 재시도하지 않음
            // 재시도가 의미있는 경우는 5xx 서버 에러나 네트워크 오류만
            const shouldRetry = !error.status || error.status >= 500;
            
            if (error.status === 404) {
                console.log('ℹ️ 404 에러 - 리소스 없음 (재시도 안 함)');
                throw error;
            }
            
            if (error.status && error.status >= 400 && error.status < 500) {
                console.log(`ℹ️ ${error.status} 클라이언트 에러 (재시도 안 함)`);
                throw error;
            }
            
            // 재시도 (네트워크 오류 또는 5xx 서버 에러)
            if (shouldRetry && retryCount < this.maxRetries) {
                console.log(`재시도 ${retryCount + 1}/${this.maxRetries}... (서버/네트워크 오류)`);
                
                // 지수 백오프
                await this.sleep(this.retryDelay * Math.pow(2, retryCount));
                
                return this.sendRequest(url, method, data, retryCount + 1);
            }
            
            throw error;
        }
    }
    
    /**
     * 대기
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ===== 알림 =====
    
    /**
     * 알림 표시
     * @param {String} message - 메시지
     * @param {String} type - 타입 (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        console.log(`📢 알림 [${type}]:`, message);
        
        // 나중에 UIManager에서 처리
        // 지금은 콘솔로만 출력
        
        // 간단한 알림 (임시)
        if (type === 'error') {
            alert(message);
        }
    }
    
    // ===== 유틸리티 =====
    
    /**
     * 현재 학교 ID 설정
     */
    setCurrentSchoolId(schoolId) {
        this.currentSchoolId = schoolId;
        console.log('🏫 현재 학교 ID 설정:', schoolId);
    }
    
    /**
     * 현재 학교 ID 가져오기
     */
    getCurrentSchoolId() {
        return this.currentSchoolId;
    }
    
    /**
     * 저장 중인지 확인
     */
    isSaving() {
        return this.core.state.isSaving;
    }
    
    /**
     * 로딩 중인지 확인
     */
    isLoading() {
        return this.core.state.isLoading;
    }
    
    // ===== 정리 =====
    
    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ DataSyncManager 정리 시작');
        
        this.disableAutoSave();
        
        console.log('✅ DataSyncManager 정리 완료');
    }
}

