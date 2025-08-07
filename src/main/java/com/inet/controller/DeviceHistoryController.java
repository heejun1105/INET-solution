package com.inet.controller;

import com.inet.entity.DeviceHistory;
import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.service.DeviceHistoryService;
import com.inet.service.SchoolService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import com.inet.entity.Feature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequestMapping("/device/history")
@RequiredArgsConstructor
@Slf4j
public class DeviceHistoryController {
    
    private final DeviceHistoryService deviceHistoryService;
    private final SchoolService schoolService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;
    
    /**
     * 장비수정내역 목록 페이지
     */
    @GetMapping("/list")
    public String list(@RequestParam(required = false) Long schoolId,
                      @RequestParam(required = false) String searchType,
                      @RequestParam(required = false) String searchKeyword,
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "20") int size,
                      Model model,
                      RedirectAttributes redirectAttributes) {
        
        // 권한 체크
        User user = checkPermission(Feature.DEVICE_LIST, redirectAttributes);
        if (user == null) {
            return "redirect:/auth/login";
        }
        
        // 학교 목록 조회
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        
        // 장비 유형 목록 조회
        List<String> types = deviceHistoryService.getAllDeviceTypes();
        model.addAttribute("types", types);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        // 학교 선택 여부 확인
        if (schoolId == null) {
            model.addAttribute("message", "학교를 선택해주세요.");
            return "device/history";
        }
        
        // 학교 권한 체크
        user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/device/list";
        }
        
        // 수정내역 조회
        Page<DeviceHistory> historyPage;
        if (searchType != null && !searchType.isEmpty() || 
            searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            historyPage = deviceHistoryService.getDeviceHistoryBySchoolAndSearch(
                schoolId, searchType, searchKeyword, page, size);
        } else {
            historyPage = deviceHistoryService.getDeviceHistoryBySchool(schoolId, page, size);
        }
        
        // 선택된 학교 정보
        School selectedSchool = schoolService.getSchoolById(schoolId).orElse(null);
        
        model.addAttribute("historyPage", historyPage);
        model.addAttribute("selectedSchool", selectedSchool);
        model.addAttribute("schoolId", schoolId);
        model.addAttribute("searchType", searchType);
        model.addAttribute("searchKeyword", searchKeyword);
        model.addAttribute("currentPage", page);
        model.addAttribute("pageSize", size);
        
        return "device/history";
    }
    
    /**
     * 장비수정내역 엑셀 다운로드
     */
    @GetMapping("/excel")
    public void downloadExcel(@RequestParam Long schoolId,
                            @RequestParam(required = false) String searchType,
                            @RequestParam(required = false) String searchKeyword,
                            jakarta.servlet.http.HttpServletResponse response) throws Exception {
        
        // 권한 체크
        User user = checkPermission(Feature.DEVICE_LIST, null);
        if (user == null) {
            response.sendError(403, "권한이 없습니다.");
            return;
        }
        
        // 학교 권한 체크
        user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, null);
        if (user == null) {
            response.sendError(403, "해당 학교에 대한 권한이 없습니다.");
            return;
        }
        
        // 수정내역 조회
        List<DeviceHistory> histories;
        if (searchType != null && !searchType.isEmpty() || 
            searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            Page<DeviceHistory> page = deviceHistoryService.getDeviceHistoryBySchoolAndSearch(
                schoolId, searchType, searchKeyword, 1, Integer.MAX_VALUE);
            histories = page.getContent();
        } else {
            histories = deviceHistoryService.getAllDeviceHistoryBySchool(schoolId);
        }
        
        // 엑셀 파일 생성
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=device_history.xlsx");
        
        // Apache POI를 사용하여 엑셀 파일 생성
        org.apache.poi.ss.usermodel.Workbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
        org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("장비수정내역");
        
        // 헤더 생성
        org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(0);
        String[] headers = {"수정일시", "장비구분", "제조사", "모델명", "IP주소", "수정필드", "수정전", "수정후", "수정자"};
        for (int i = 0; i < headers.length; i++) {
            org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
        }
        
        // 데이터 생성
        int rowNum = 1;
        for (DeviceHistory history : histories) {
            org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowNum++);
            
            row.createCell(0).setCellValue(history.getModifiedAt().toString());
            row.createCell(1).setCellValue(history.getDevice().getType() != null ? history.getDevice().getType() : "");
            row.createCell(2).setCellValue(history.getDevice().getManufacturer() != null ? history.getDevice().getManufacturer() : "");
            row.createCell(3).setCellValue(history.getDevice().getModelName() != null ? history.getDevice().getModelName() : "");
            row.createCell(4).setCellValue(history.getDevice().getIpAddress() != null ? history.getDevice().getIpAddress() : "");
            row.createCell(5).setCellValue(deviceHistoryService.getFieldNameInKorean(history.getFieldName()));
            row.createCell(6).setCellValue(history.getBeforeValue() != null ? history.getBeforeValue() : "");
            row.createCell(7).setCellValue(history.getAfterValue() != null ? history.getAfterValue() : "");
            row.createCell(8).setCellValue(history.getModifiedBy().getName());
        }
        
        // 컬럼 너비 자동 조정
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        workbook.write(response.getOutputStream());
        workbook.close();
    }
    
    // 권한 체크 메서드
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            }
            return null;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            }
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            }
            return null;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            }
            return null;
        }
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }
}
