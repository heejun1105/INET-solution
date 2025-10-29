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
                
                return true;
            } else {
                throw new Error(response.message || '평면도 저장에 실패했습니다.');
            }
            
        } catch (error) {
            console.error('❌ 평면도 저장 실패:', error);
            
            if (showNotification) {
                this.showNotification('평면도 저장 중 오류가 발생했습니다.', 'error');
            }
            
            throw error;
            
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
     * 저장 데이터 준비
     */
    prepareSaveData() {
        const { elements, canvasWidth, canvasHeight, zoom, panX, panY, gridSize, showGrid, snapToGrid } = this.core.state;
        
        // 모든 요소 저장 (타입 구분 없이)
        const allElements = elements.map(element => {
            const elementData = { ...element };
            
            // temp로 시작하는 ID는 null로 설정
            if (elementData.id && elementData.id.toString().startsWith('temp')) {
                elementData.id = null;
            }
            
            // parentElementId를 parentId로 변환 (백엔드 호환)
            if (elementData.parentElementId) {
                elementData.parentId = elementData.parentElementId;
            }
            
            return elementData;
        });
        
        console.log('💾 저장할 요소들:', allElements.map(el => ({
            type: el.elementType,
            label: el.label,
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
        const loadedElements = elements.map(el => {
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
        
        this.core.setElements(loadedElements);
        
        // 로드 후 검증
        this.validateAfterLoad();
        
        console.log('✅ 평면도 로드 완료:', {
            요소수: loadedElements.length,
            캔버스크기: `${floorPlan.canvasWidth}x${floorPlan.canvasHeight}`,
            줌: floorPlan.zoomLevel
        });
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

