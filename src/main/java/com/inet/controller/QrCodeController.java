package com.inet.controller;

import com.inet.entity.Feature;
import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.service.QrCodeService;
import com.inet.service.SchoolService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.util.List;
import com.google.zxing.WriterException;

@Controller
@RequestMapping("/qr-code")
public class QrCodeController {
    
    @Autowired
    private QrCodeService qrCodeService;
    
    @Autowired
    private SchoolService schoolService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PermissionHelper permissionHelper;
    
    /**
     * QR 코드 생성 페이지를 표시합니다.
     */
    @GetMapping("/generate")
    public String showQrCodeGenerationPage(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.QR_CODE_GENERATION, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        // 모든 학교 목록 가져오기
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(user, model);
        
        return "qr-code/generate";
    }
    
    /**
     * 선택된 학교의 QR 코드 엑셀 파일을 생성하고 다운로드합니다.
     */
    @PostMapping("/download")
    public ResponseEntity<ByteArrayResource> downloadQrCodeExcel(
            @RequestParam Long schoolId,
            @RequestParam(value = "infoLines", required = false) List<String> infoLines,
            RedirectAttributes redirectAttributes) throws IOException, WriterException {
        
        try {
            School school = schoolService.findById(schoolId)
                    .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
            
            byte[] excelBytes = qrCodeService.generateQrCodeExcel(schoolId, infoLines);
            
            ByteArrayResource resource = new ByteArrayResource(excelBytes);
            
            String filename = school.getSchoolName() + "_QR코드.xlsx";
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .contentLength(excelBytes.length)
                    .body(resource);
                    
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("errorMessage", "QR 코드 엑셀 파일 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 선택된 학교의 데이터 엑셀 파일을 생성하고 다운로드합니다 (A~D열에 설정 순서대로).
     */
    @PostMapping("/download-data")
    public ResponseEntity<ByteArrayResource> downloadDataExcel(
            @RequestParam Long schoolId,
            @RequestParam(value = "infoLines", required = false) List<String> infoLines,
            RedirectAttributes redirectAttributes) throws IOException {
        
        try {
            School school = schoolService.findById(schoolId)
                    .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
            
            byte[] excelBytes = qrCodeService.generateDataExcel(schoolId, infoLines);
            
            ByteArrayResource resource = new ByteArrayResource(excelBytes);
            
            String filename = school.getSchoolName() + "_데이터.xlsx";
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .contentLength(excelBytes.length)
                    .body(resource);
                    
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("errorMessage", "데이터 엑셀 파일 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 필터링된 장비들의 QR 코드 엑셀 파일을 생성하고 다운로드합니다.
     */
    @PostMapping("/download-filtered")
    public ResponseEntity<ByteArrayResource> downloadQrCodeExcelFiltered(
            @RequestParam Long schoolId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "classroomId", required = false) Long classroomId,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "infoLines", required = false) List<String> infoLines,
            RedirectAttributes redirectAttributes) throws IOException, WriterException {
        
        try {
            School school = schoolService.findById(schoolId)
                    .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
            
            byte[] excelBytes = qrCodeService.generateQrCodeExcelFiltered(schoolId, type, classroomId, searchKeyword, infoLines);
            
            ByteArrayResource resource = new ByteArrayResource(excelBytes);
            
            String filename = school.getSchoolName() + "_QR코드.xlsx";
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .contentLength(excelBytes.length)
                    .body(resource);
                    
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("errorMessage", "QR 코드 엑셀 파일 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 필터링된 장비들의 데이터 엑셀 파일을 생성하고 다운로드합니다 (A~D열에 설정 순서대로).
     */
    @PostMapping("/download-data-filtered")
    public ResponseEntity<ByteArrayResource> downloadDataExcelFiltered(
            @RequestParam Long schoolId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "classroomId", required = false) Long classroomId,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "infoLines", required = false) List<String> infoLines,
            RedirectAttributes redirectAttributes) throws IOException {
        
        try {
            School school = schoolService.findById(schoolId)
                    .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
            
            byte[] excelBytes = qrCodeService.generateDataExcelFiltered(schoolId, type, classroomId, searchKeyword, infoLines);
            
            ByteArrayResource resource = new ByteArrayResource(excelBytes);
            
            String filename = school.getSchoolName() + "_데이터.xlsx";
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .contentLength(excelBytes.length)
                    .body(resource);
                    
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("errorMessage", "데이터 엑셀 파일 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 권한 체크 메서드
     */
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
}
