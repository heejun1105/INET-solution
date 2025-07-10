export default class ScrollFixManager {
    constructor() {
        this.elements = [];
        this.init();
    }

    init() {
        // 고정할 요소들을 등록
        this.registerElement('.toolbar.active', 60); // 네비바 높이만큼 offset
        this.registerElement('.zoom-controls', 140); // 네비바 + 도구모음 높이
        this.registerElement('.unplaced-rooms-panel', 140);
        this.registerElement('.panel-toggle', 175); // 충분한 여유 공간 확보

        // 스크롤 이벤트 리스너 등록 (쓰로틀링 적용)
        this.throttledHandleScroll = this.throttle(this.handleScroll.bind(this), 10);
        window.addEventListener('scroll', this.throttledHandleScroll);
        
        // 초기 상태 설정
        this.handleScroll();
    }

    registerElement(selector, fixedTop) {
        const element = document.querySelector(selector);
        if (element) {
            this.elements.push({
                element: element,
                selector: selector,
                fixedTop: fixedTop,
                originalTop: this.getElementTop(element),
                lastCheck: 0
            });
        }
    }

    getElementTop(element) {
        const rect = element.getBoundingClientRect();
        return rect.top + window.pageYOffset;
    }

    handleScroll() {
        const scrollTop = window.pageYOffset;
        const now = Date.now();

        this.elements.forEach(item => {
            // 빈번한 DOM 조회를 줄이기 위한 최적화
            if (now - item.lastCheck < 50) return;
            item.lastCheck = now;

            // 현재 요소가 DOM에 있는지 확인 (동적으로 변경될 수 있음)
            const currentElement = document.querySelector(item.selector);
            if (!currentElement) return;

            // 요소가 변경되었다면 업데이트
            if (currentElement !== item.element) {
                item.element = currentElement;
            }

            // 원래 위치를 업데이트 (toolbar가 active 상태로 변경될 수 있음)
            if (!currentElement.classList.contains('fixed')) {
                const newTop = this.getElementTop(currentElement);
                // 위치가 크게 변경된 경우에만 업데이트
                if (Math.abs(newTop - item.originalTop) > 5) {
                    item.originalTop = newTop;
                }
            }

            // 스크롤 위치가 요소의 원래 위치를 넘어섰는지 확인
            const shouldFix = scrollTop > (item.originalTop - item.fixedTop);

            if (shouldFix && !currentElement.classList.contains('fixed')) {
                currentElement.classList.add('fixed');
            } else if (!shouldFix && currentElement.classList.contains('fixed')) {
                currentElement.classList.remove('fixed');
            }
        });
    }

    // 쓰로틸링 유틸리티 함수
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // 요소 재등록 (모드 변경 시 호출)
    reregister() {
        this.elements = [];
        setTimeout(() => {
            this.init();
        }, 100); // DOM 업데이트 후 재등록
    }

    // 리소스 정리
    destroy() {
        window.removeEventListener('scroll', this.throttledHandleScroll);
        this.elements = [];
    }
} 