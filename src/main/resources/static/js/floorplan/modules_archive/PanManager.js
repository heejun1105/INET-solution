/**
 * 팬(Pan) 관리자
 * 스페이스바 + 드래그, 마우스 휠 드래그로 캔버스 이동
 */
export default class PanManager {
    constructor(infiniteCanvasManager, container) {
        this.infiniteCanvasManager = infiniteCanvasManager;
        this.container = container;
        
        // 팬 상태
        this.isPanning = false;
        this.isSpacePressed = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // 원래 커서 스타일
        this.originalCursor = '';
        
        // 이벤트 핸들러 바인딩
        this.boundHandlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            mouseDown: this.handleMouseDown.bind(this),
            mouseMove: this.handleMouseMove.bind(this),
            mouseUp: this.handleMouseUp.bind(this),
            wheel: this.handleWheel.bind(this)
        };
        
        this.enabled = false;
    }
    
    /**
     * 팬 기능 활성화
     */
    enable() {
        if (this.enabled) return;
        
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);
        this.container.addEventListener('mousedown', this.boundHandlers.mouseDown);
        this.container.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        
        this.enabled = true;
        console.log('✅ PanManager enabled');
    }
    
    /**
     * 팬 기능 비활성화
     */
    disable() {
        if (!this.enabled) return;
        
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        document.removeEventListener('keyup', this.boundHandlers.keyUp);
        this.container.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.container.removeEventListener('wheel', this.boundHandlers.wheel);
        
        this.endPan();
        this.enabled = false;
        console.log('❌ PanManager disabled');
    }
    
    /**
     * 키 다운 이벤트
     */
    handleKeyDown(event) {
        // 스페이스바 또는 Shift 키
        if (event.code === 'Space' && !event.repeat) {
            event.preventDefault();
            this.isSpacePressed = true;
            this.updateCursor();
        }
    }
    
    /**
     * 키 업 이벤트
     */
    handleKeyUp(event) {
        if (event.code === 'Space') {
            this.isSpacePressed = false;
            this.updateCursor();
            
            // 팬 중이었으면 종료
            if (this.isPanning) {
                this.endPan();
            }
        }
    }
    
    /**
     * 마우스 다운 이벤트
     */
    handleMouseDown(event) {
        // 스페이스바가 눌려있거나 마우스 가운데 버튼
        if (this.isSpacePressed || event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
            
            this.startPan(event.clientX, event.clientY);
        }
    }
    
    /**
     * 마우스 무브 이벤트
     */
    handleMouseMove(event) {
        if (!this.isPanning) return;
        
        event.preventDefault();
        
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        
        this.pan(deltaX, deltaY);
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    
    /**
     * 마우스 업 이벤트
     */
    handleMouseUp(event) {
        if (this.isPanning) {
            event.preventDefault();
            this.endPan();
        }
    }
    
    /**
     * 휠 이벤트 (Shift + 휠로 수평 스크롤)
     */
    handleWheel(event) {
        if (event.shiftKey) {
            event.preventDefault();
            
            // 수평 팬
            const deltaX = event.deltaY;
            this.pan(deltaX, 0);
        }
    }
    
    /**
     * 팬 시작
     */
    startPan(clientX, clientY) {
        this.isPanning = true;
        this.lastMouseX = clientX;
        this.lastMouseY = clientY;
        
        // 이벤트 리스너 추가
        document.addEventListener('mousemove', this.boundHandlers.mouseMove);
        document.addEventListener('mouseup', this.boundHandlers.mouseUp);
        
        // 커서 변경
        this.originalCursor = this.container.style.cursor;
        this.container.style.cursor = 'grabbing';
        
        // 사용자 선택 비활성화
        document.body.style.userSelect = 'none';
        
        console.log('🖐️ Pan started');
    }
    
    /**
     * 팬 실행
     */
    pan(deltaX, deltaY) {
        const transform = this.infiniteCanvasManager.getTransform();
        
        this.infiniteCanvasManager.setTransform(
            transform.scale,
            transform.translateX + deltaX,
            transform.translateY + deltaY
        );
    }
    
    /**
     * 팬 종료
     */
    endPan() {
        if (!this.isPanning) return;
        
        this.isPanning = false;
        
        // 이벤트 리스너 제거
        document.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        document.removeEventListener('mouseup', this.boundHandlers.mouseUp);
        
        // 커서 복원
        this.updateCursor();
        
        // 사용자 선택 활성화
        document.body.style.userSelect = '';
        
        console.log('🖐️ Pan ended');
    }
    
    /**
     * 커서 업데이트
     */
    updateCursor() {
        if (this.isPanning) {
            this.container.style.cursor = 'grabbing';
        } else if (this.isSpacePressed) {
            this.container.style.cursor = 'grab';
        } else {
            this.container.style.cursor = this.originalCursor || 'default';
        }
    }
    
    /**
     * 팬 가능 여부
     */
    canPan() {
        return this.isSpacePressed || this.isPanning;
    }
    
    /**
     * 정리
     */
    destroy() {
        this.disable();
    }
}

