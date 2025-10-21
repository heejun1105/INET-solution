/**
 * UIManager.js
 * UI 통합 관리
 * 
 * 책임:
 * - 툴바 관리
 * - 모달 관리
 * - 학교 선택
 * - 상태 표시
 * - 알림/토스트
 */

export default class UIManager {
    /**
     * @param {FloorPlanCore} core - FloorPlanCore 인스턴스
     * @param {DataSyncManager} dataSyncManager - DataSyncManager 인스턴스
     * @param {ElementManager} elementManager - ElementManager 인스턴스
     */
    constructor(core, dataSyncManager, elementManager) {
        if (!core || !dataSyncManager || !elementManager) {
            throw new Error('Required managers are missing');
        }
        
        console.log('🎨 UIManager 초기화 시작');
        
        this.core = core;
        this.dataSyncManager = dataSyncManager;
        this.elementManager = elementManager;
        
        // UI 요소 참조
        this.toolbar = null;
        this.statusBar = null;
        this.modal = null;
        
        // 학교 목록
        this.schools = [];
        
        console.log('✅ UIManager 초기화 완료');
    }
    
    // ===== 툴바 =====
    
    /**
     * 설계 모드 툴바 생성
     */
    createDesignToolbar(container) {
        console.log('🔧 설계 모드 툴바 생성');
        
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'design-toolbar';
        this.toolbar.style.cssText = `
            position: fixed;
            top: 80px;
            left: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 15px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
        `;
        
        // 툴바 버튼들
        const buttons = [
            { icon: 'fa-mouse-pointer', title: '선택 (V)', action: () => this.setTool('select') },
            { icon: 'fa-hand-paper', title: '팬 (Space)', action: () => this.setTool('pan') },
            { separator: true },
            { icon: 'fa-building', title: '건물 추가', action: () => this.addElement('building') },
            { icon: 'fa-door-open', title: '교실 추가', action: () => this.addElement('room') },
            { icon: 'fa-wifi', title: '무선AP 추가', action: () => this.addElement('wireless_ap') },
            { separator: true },
            { icon: 'fa-square', title: '사각형', action: () => this.addShape('rectangle') },
            { icon: 'fa-circle', title: '원', action: () => this.addShape('circle') },
            { icon: 'fa-minus', title: '선', action: () => this.addShape('line') },
            { icon: 'fa-font', title: '텍스트', action: () => this.addShape('text') },
            { separator: true },
            { icon: 'fa-save', title: '저장 (Ctrl+S)', action: () => this.save(), className: 'btn-primary' },
            { icon: 'fa-folder-open', title: '불러오기', action: () => this.load() },
            { icon: 'fa-trash', title: '삭제', action: () => this.deleteSelected(), className: 'btn-danger' },
            { separator: true },
            { icon: 'fa-undo', title: '실행 취소 (Ctrl+Z)', action: () => this.undo() },
            { icon: 'fa-redo', title: '다시 실행 (Ctrl+Y)', action: () => this.redo() },
            { separator: true },
            { icon: 'fa-times', title: '설계 모드 종료', action: () => this.exitDesignMode(), className: 'btn-danger' }
        ];
        
        for (const btn of buttons) {
            if (btn.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #e5e7eb; margin: 5px 0;';
                this.toolbar.appendChild(separator);
            } else {
                const button = this.createToolbarButton(btn);
                this.toolbar.appendChild(button);
            }
        }
        
        container.appendChild(this.toolbar);
    }
    
    /**
     * 툴바 버튼 생성
     */
    createToolbarButton(config) {
        const button = document.createElement('button');
        button.className = `toolbar-btn ${config.className || ''}`;
        button.title = config.title;
        button.style.cssText = `
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 44px;
            min-height: 44px;
        `;
        
        button.innerHTML = `<i class="fas ${config.icon}"></i>`;
        
        button.addEventListener('click', config.action);
        
        // 호버 효과
        button.addEventListener('mouseenter', () => {
            button.style.background = '#f3f4f6';
            button.style.borderColor = '#9ca3af';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = 'white';
            button.style.borderColor = '#d1d5db';
        });
        
        return button;
    }
    
    /**
     * 툴 설정
     */
    setTool(tool) {
        console.log('🔧 툴 설정:', tool);
        // 추후 구현
    }
    
    /**
     * 요소 추가
     */
    addElement(elementType) {
        console.log('➕ 요소 추가:', elementType);
        
        // 캔버스 중앙에 추가
        const centerX = (this.core.state.canvasWidth / 2) - (this.elementManager.getDefaultWidth(elementType) / 2);
        const centerY = (this.core.state.canvasHeight / 2) - (this.elementManager.getDefaultHeight(elementType) / 2);
        
        this.elementManager.createElement(elementType, {
            xCoordinate: centerX,
            yCoordinate: centerY
        });
    }
    
    /**
     * 도형 추가
     */
    addShape(shapeType) {
        console.log('🔷 도형 추가:', shapeType);
        
        const centerX = (this.core.state.canvasWidth / 2) - 50;
        const centerY = (this.core.state.canvasHeight / 2) - 50;
        
        this.elementManager.createElement('shape', {
            xCoordinate: centerX,
            yCoordinate: centerY,
            shapeType
        });
    }
    
    /**
     * 저장
     */
    async save() {
        console.log('💾 저장 실행');
        
        const schoolId = this.dataSyncManager.getCurrentSchoolId();
        if (!schoolId) {
            alert('학교를 먼저 선택해주세요.');
            return;
        }
        
        try {
            await this.dataSyncManager.save(schoolId);
        } catch (error) {
            console.error('저장 실패:', error);
        }
    }
    
    /**
     * 불러오기
     */
    async load() {
        console.log('📥 불러오기 실행');
        
        const schoolId = this.dataSyncManager.getCurrentSchoolId();
        if (!schoolId) {
            alert('학교를 먼저 선택해주세요.');
            return;
        }
        
        try {
            await this.dataSyncManager.load(schoolId);
        } catch (error) {
            console.error('불러오기 실패:', error);
        }
    }
    
    /**
     * 선택 삭제
     */
    deleteSelected() {
        const selected = this.core.state.selectedElements;
        
        if (selected.length === 0) {
            alert('삭제할 요소를 선택해주세요.');
            return;
        }
        
        const confirmed = confirm(`${selected.length}개의 요소를 삭제하시겠습니까?`);
        if (!confirmed) {
            return;
        }
        
        this.elementManager.deleteElements(selected);
        this.core.setState({ selectedElements: [] });
    }
    
    /**
     * 실행 취소 (추후 구현)
     */
    undo() {
        console.log('↶ 실행 취소');
        // 추후 구현 (History Manager 필요)
    }
    
    /**
     * 다시 실행 (추후 구현)
     */
    redo() {
        console.log('↷ 다시 실행');
        // 추후 구현 (History Manager 필요)
    }
    
    /**
     * 설계 모드 종료
     */
    exitDesignMode() {
        console.log('🚪 설계 모드 종료');
        
        if (window.exitDesignMode) {
            window.exitDesignMode();
        }
    }
    
    // ===== 상태 바 =====
    
    /**
     * 상태 바 생성
     */
    createStatusBar(container) {
        console.log('📊 상태 바 생성');
        
        this.statusBar = document.createElement('div');
        this.statusBar.className = 'status-bar';
        this.statusBar.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 10px 15px;
            z-index: 1000;
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: #6b7280;
        `;
        
        this.statusBar.innerHTML = `
            <span id="status-elements">요소: 0</span>
            <span id="status-selected">선택: 0</span>
            <span id="status-zoom">줌: 100%</span>
        `;
        
        container.appendChild(this.statusBar);
        
        // 상태 업데이트 주기적으로
        setInterval(() => this.updateStatusBar(), 500);
    }
    
    /**
     * 상태 바 업데이트
     */
    updateStatusBar() {
        if (!this.statusBar) return;
        
        const elementsSpan = this.statusBar.querySelector('#status-elements');
        const selectedSpan = this.statusBar.querySelector('#status-selected');
        const zoomSpan = this.statusBar.querySelector('#status-zoom');
        
        if (elementsSpan) {
            elementsSpan.textContent = `요소: ${this.core.state.elements.length}`;
        }
        
        if (selectedSpan) {
            selectedSpan.textContent = `선택: ${this.core.state.selectedElements.length}`;
        }
        
        if (zoomSpan) {
            zoomSpan.textContent = `줌: ${(this.core.state.zoom * 100).toFixed(0)}%`;
        }
    }
    
    // ===== 학교 선택 =====
    
    /**
     * 학교 선택 모달 표시
     */
    showSchoolSelectModal(schools) {
        console.log('🏫 학교 선택 모달 표시');
        
        this.schools = schools;
        
        // 기존 모달 제거
        if (this.modal) {
            this.modal.remove();
        }
        
        // 모달 생성
        this.modal = document.createElement('div');
        this.modal.className = 'school-select-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;
        
        this.modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 30px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h2 style="margin: 0 0 20px 0; font-size: 24px;">학교 선택</h2>
                
                <input 
                    type="text" 
                    id="school-search" 
                    placeholder="학교 검색..." 
                    style="
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        font-size: 14px;
                    "
                />
                
                <div id="school-list" style="
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-height: 400px;
                    overflow-y: auto;
                ">
                    ${this.renderSchoolList(schools)}
                </div>
                
                <div style="
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                ">
                    <button id="modal-cancel" style="
                        padding: 10px 20px;
                        border: 1px solid #d1d5db;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                    ">취소</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // 이벤트 리스너
        const searchInput = this.modal.querySelector('#school-search');
        searchInput.addEventListener('input', (e) => {
            this.filterSchools(e.target.value);
        });
        
        const cancelBtn = this.modal.querySelector('#modal-cancel');
        cancelBtn.addEventListener('click', () => {
            this.hideSchoolSelectModal();
        });
        
        // 모달 외부 클릭 시 닫기
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideSchoolSelectModal();
            }
        });
        
        // 학교 항목 이벤트 리스너 등록
        this.attachSchoolItemListeners();
    }
    
    /**
     * 학교 목록 렌더링
     */
    renderSchoolList(schools) {
        if (!schools || schools.length === 0) {
            return '<p style="text-align: center; color: #9ca3af;">학교가 없습니다.</p>';
        }
        
        return schools.map(school => `
            <button 
                class="school-item" 
                data-school-id="${school.schoolId}"
                style="
                    padding: 15px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                "
                onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#3b82f6';"
                onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb';"
            >
                <div style="font-weight: 600; font-size: 16px;">${school.schoolName}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${school.address || ''}</div>
            </button>
        `).join('');
    }
    
    /**
     * 학교 필터링
     */
    filterSchools(searchTerm) {
        const filtered = this.schools.filter(school =>
            school.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        const schoolList = this.modal.querySelector('#school-list');
        schoolList.innerHTML = this.renderSchoolList(filtered);
        
        // 이벤트 리스너 재등록
        this.attachSchoolItemListeners();
    }
    
    /**
     * 학교 항목 리스너 등록
     */
    attachSchoolItemListeners() {
        const schoolItems = this.modal.querySelectorAll('.school-item');
        
        for (const item of schoolItems) {
            item.addEventListener('click', () => {
                const schoolId = parseInt(item.getAttribute('data-school-id'));
                this.selectSchool(schoolId);
            });
        }
    }
    
    /**
     * 학교 선택
     */
    async selectSchool(schoolId) {
        console.log('🏫 학교 선택:', schoolId);
        
        try {
            // 학교 ID 설정
            this.dataSyncManager.setCurrentSchoolId(schoolId);
            
            // 평면도 로드 시도
            await this.dataSyncManager.load(schoolId);
            
            // 모달 닫기
            this.hideSchoolSelectModal();
            
        } catch (error) {
            console.error('학교 선택 실패:', error);
        }
    }
    
    /**
     * 학교 선택 모달 숨기기
     */
    hideSchoolSelectModal() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
    
    // ===== 알림 =====
    
    /**
     * 토스트 알림 표시
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;
        
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // ===== 키보드 단축키 =====
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        console.log('⌨️ 키보드 단축키 설정');
        
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: 저장
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.save();
            }
            
            // Ctrl/Cmd + Z: 실행 취소
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            
            // Ctrl/Cmd + Y: 다시 실행
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
            
            // Ctrl/Cmd + A: 전체 선택
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                // InteractionManager에서 처리
            }
        });
    }
    
    // ===== 알림 =====
    
    /**
     * 알림 표시
     * @param {string} title - 제목
     * @param {string} message - 메시지
     * @param {string} type - 타입 (info, success, warning, error)
     * @param {number} duration - 지속 시간 (ms), 0이면 무한
     */
    showNotification(title, message, type = 'info', duration = 3000) {
        console.log(`📢 알림: [${type}] ${title} - ${message}`);
        
        // 기존 알림 제거
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        
        // 알림 생성
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 15px 20px;
            min-width: 300px;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        const icon = type === 'success' ? '✓' : 
                    type === 'error' ? '✗' : 
                    type === 'warning' ? '⚠' : 'ℹ';
        const color = type === 'success' ? '#10b981' : 
                     type === 'error' ? '#ef4444' : 
                     type === 'warning' ? '#f59e0b' : '#3b82f6';
        
        toast.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px;">
                <div style="font-size: 24px; color: ${color};">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #111; margin-bottom: 4px;">${title}</div>
                    <div style="font-size: 14px; color: #666;">${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; font-size: 20px; 
                               color: #999; cursor: pointer; padding: 0; line-height: 1;">×</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 자동 제거
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'slideOut 0.3s ease-out';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    }
    
    /**
     * 알림 숨기기
     */
    hideNotification() {
        const toast = document.querySelector('.toast-notification');
        if (toast) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }
    }
    
    // ===== 정리 =====
    
    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ UIManager 정리 시작');
        
        if (this.toolbar) {
            this.toolbar.remove();
        }
        
        if (this.statusBar) {
            this.statusBar.remove();
        }
        
        if (this.modal) {
            this.modal.remove();
        }
        
        console.log('✅ UIManager 정리 완료');
    }
}

