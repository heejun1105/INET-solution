package com.inet.controller;

import com.inet.entity.Device;
import com.inet.entity.School;
import com.inet.entity.Manage;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.DeviceService;
import com.inet.service.SchoolService;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddress;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.HashMap;
import java.util.Set;
import java.util.Objects;
import java.util.ArrayList;
import java.util.HashSet;
import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/ip")
@RequiredArgsConstructor
public class IpController {

    private static final Logger logger = LoggerFactory.getLogger(IpController.class);
    private final DeviceService deviceService;
    private final SchoolService schoolService;
    private final PermissionService permissionService;
    private final SchoolPermissionService schoolPermissionService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;
    private final com.inet.service.DeviceHistoryService deviceHistoryService;
    
    // 권한 체크 메서드
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
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
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
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }

    // IP 주소 유효성 검사 메서드
    private boolean isValidIpAddress(String ipAddress) {
        if (ipAddress == null || ipAddress.isEmpty()) {
            return false;
        }
        
        // 10.으로 시작하는지 확인
        if (!ipAddress.startsWith("10.")) {
            return false;
        }
        
        // IP 주소 형식 검사
        String ipPattern = "^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$";
        if (!ipAddress.matches(ipPattern)) {
            return false;
        }
        
        // 한글이나 특수문자 포함 여부 검사
        if (ipAddress.matches(".*[ㄱ-ㅎㅏ-ㅣ가-힣].*") || 
            ipAddress.toLowerCase().contains("usb")) {
            return false;
        }
        
        // IP 주소의 각 부분이 올바른 범위인지 검사
        String[] parts = ipAddress.split("\\.");
        try {
            for (int i = 1; i < parts.length; i++) {
                int part = Integer.parseInt(parts[i]);
                if (part < 0 || part > 255) {
                    return false;
                }
            }
        } catch (NumberFormatException e) {
            return false;
        }
        
        return true;
    }

    @GetMapping("/iplist")
    public String ipList(@RequestParam(required = false) Long schoolId, 
                        @RequestParam(required = false) String secondOctet,
                        Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
        User user;
        if (schoolId != null) {
            user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, redirectAttributes);
        } else {
            user = checkPermission(Feature.DEVICE_LIST, redirectAttributes);
        }
        if (user == null) {
            return "redirect:/";
        }
        
        // 학교 목록 조회 (권한이 있는 학교만)
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", schools);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);

        School selectedSchool = null;
        if (schoolId != null) {
            selectedSchool = schoolService.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            model.addAttribute("selectedSchool", selectedSchool);

            // 해당 학교의 모든 장비 조회 및 유효한 IP 주소만 필터링
            List<Device> devices = deviceService.findDevicesBySchool(selectedSchool).stream()
                .filter(d -> isValidIpAddress(d.getIpAddress()))
                .collect(Collectors.toList());
            
            // IP 주소의 두 번째 옥텟 목록 추출
            Set<String> secondOctets = devices.stream()
                .map(d -> d.getIpAddress().split("\\.")[1])
                .collect(Collectors.toSet());
            
            model.addAttribute("secondOctets", secondOctets);
            model.addAttribute("selectedSecondOctet", secondOctet);

            // secondOctet이 null이거나 비어있으면 "all"로 처리
            if (secondOctet == null || secondOctet.isEmpty() || "all".equals(secondOctet)) {
                // IP 대역별로 장비 그룹화
                Map<String, List<Map<String, Object>>> ipListByOctet = new HashMap<>();
                Map<String, List<Device>> devicesByOctet = devices.stream()
                    .collect(Collectors.groupingBy(d -> d.getIpAddress().split("\\.")[1]));

                // 각 IP 대역별로 1-254 IP 목록 생성
                devicesByOctet.forEach((octet, deviceList) -> {
                    Map<Integer, Device> deviceMap = deviceList.stream()
                        .collect(Collectors.toMap(
                            d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                            d -> d,
                            (existing, replacement) -> existing
                        ));

                    List<Map<String, Object>> ipList = IntStream.rangeClosed(1, 254)
                        .mapToObj(i -> {
                            Map<String, Object> map = new HashMap<>();
                            map.put("number", i);
                            Device device = deviceMap.getOrDefault(i, null);
                            map.put("device", device);
                            return map;
                        })
                        .collect(Collectors.toList());

                    ipListByOctet.put(octet, ipList);
                });

                model.addAttribute("ipListByOctet", ipListByOctet);
                model.addAttribute("isAllView", true);
            } else {
                // 기존 단일 IP 대역 로직
                Map<Integer, Device> deviceMap = devices.stream()
                    .filter(d -> {
                        String[] parts = d.getIpAddress().split("\\.");
                        return parts[1].equals(secondOctet);
                    })
                    .collect(Collectors.toMap(
                        d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                        d -> d,
                        (existing, replacement) -> existing
                    ));

                List<Map<String, Object>> ipList = IntStream.rangeClosed(1, 254)
                    .mapToObj(i -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("number", i);
                        Device device = deviceMap.getOrDefault(i, null);
                        map.put("device", device);
                        return map;
                    })
                    .collect(Collectors.toList());

                model.addAttribute("ipList", ipList);
                model.addAttribute("isAllView", false);
            }
        } else {
            model.addAttribute("selectedSchool", null);
            model.addAttribute("secondOctets", new HashSet<>());
            model.addAttribute("selectedSecondOctet", null);
            model.addAttribute("ipList", new ArrayList<>());
            model.addAttribute("isAllView", false);
        }

        return "ip/iplist";
    }

    @GetMapping("/download")
    public void downloadExcel(@RequestParam Long schoolId, @RequestParam(required = false) String secondOctet, 
                            HttpServletResponse response) throws IOException {
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "로그인이 필요합니다.");
            return;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "사용자를 찾을 수 없습니다.");
            return;
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.DEVICE_LIST, schoolId, null);
        if (checkedUser == null) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "해당 학교에 대한 권한이 없습니다.");
            return;
        }
        School school = schoolService.getSchoolById(schoolId)
            .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));

        // 모든 장비 가져오기
        List<Device> allDevices = deviceService.findBySchool(schoolId).stream()
            .filter(d -> isValidIpAddress(d.getIpAddress()))
            .collect(Collectors.toList());

        // IP 대역별로 장비 그룹화
        Map<String, List<Device>> devicesByOctet = allDevices.stream()
            .collect(Collectors.groupingBy(d -> d.getIpAddress().split("\\.")[1]));

        // 학교 전체의 IP 수정일자 조회 (모든 시트에 동일한 시간 표시)
        java.time.LocalDateTime lastIpModifiedDateTime = null;
        for (Device device : allDevices) {
            Optional<java.time.LocalDateTime> lastIpModified = deviceHistoryService.getLastIpAddressModifiedDate(device);
            if (lastIpModified.isPresent()) {
                if (lastIpModifiedDateTime == null || lastIpModified.get().isAfter(lastIpModifiedDateTime)) {
                    lastIpModifiedDateTime = lastIpModified.get();
                }
            }
        }
        
        // 작성일자: IP 수정일자가 있으면 그것을 사용, 없으면 현재 날짜
        String dateStr;
        if (lastIpModifiedDateTime != null) {
            dateStr = lastIpModifiedDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } else {
            dateStr = java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        }

        // 엑셀 워크북 생성
        try (Workbook workbook = new XSSFWorkbook()) {
            // 스타일 설정
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle titleStyle = createTitleStyle(workbook, headerStyle);
            CellStyle dataStyle = createDataStyle(workbook);
            CellStyle warningStyle = createWarningStyle(workbook, dataStyle);
            CellStyle sectionHeaderStyle = createSectionHeaderStyle(workbook);

            if ("all".equalsIgnoreCase(secondOctet)) {
                // 전체 IP 대역을 하나의 시트에 표시
                createCombinedSheet(workbook, devicesByOctet, dateStr, titleStyle, headerStyle, 
                                  dataStyle, warningStyle, sectionHeaderStyle);
            } else if (secondOctet != null && !secondOctet.isEmpty()) {
                // 단일 시트 생성
                createSheet(workbook, secondOctet, devicesByOctet.getOrDefault(secondOctet, new ArrayList<>()), 
                          dateStr, titleStyle, headerStyle, dataStyle, warningStyle);
            } else {
                // 각 IP 대역별로 시트 생성
                devicesByOctet.keySet().stream()
                    .sorted((a, b) -> Integer.parseInt(a) - Integer.parseInt(b))
                    .forEach(octet -> createSheet(workbook, octet, devicesByOctet.get(octet), 
                                                dateStr, titleStyle, headerStyle, dataStyle, warningStyle));
            }

            // 파일 다운로드 설정
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            String fileName = String.format("IP대장업무용(10.%s.36.001-254).xlsx",
                "all".equalsIgnoreCase(secondOctet) ? "ALL" : 
                (secondOctet != null ? secondOctet : "ALL"));
            response.setHeader("Content-Disposition", "attachment; filename=" + fileName);

            // 파일 쓰기
            workbook.write(response.getOutputStream());
        }
    }

    // 스타일 생성 메서드들
    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        return style;
    }

    private CellStyle createTitleStyle(Workbook workbook, CellStyle headerStyle) {
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(headerStyle);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createWarningStyle(Workbook workbook, CellStyle dataStyle) {
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(dataStyle);
        style.setFillForegroundColor(IndexedColors.ROSE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    // 구분선용 스타일 생성
    private CellStyle createSectionHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        return style;
    }

    // 전체 IP 대역을 하나의 시트에 표시하는 메서드
    private void createCombinedSheet(Workbook workbook, Map<String, List<Device>> devicesByOctet,
                                   String dateStr,
                                   CellStyle titleStyle, CellStyle headerStyle, 
                                   CellStyle dataStyle, CellStyle warningStyle,
                                   CellStyle sectionHeaderStyle) {
        Sheet sheet = workbook.createSheet("IP대장");
        
        // 제목 행 (1행)
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(40);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("IP대장업무용(전체 IP 대역)");
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 15));
        
        // 날짜 행 (2행)
        // 작성일자 스타일 생성 (배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (기본 스타일 유지)
        
        // 두번째 행: 작성일자 (오른쪽 끝에 배치)
        int lastCol = 15; // 마지막 컬럼
        Row dateRow = sheet.createRow(1);
        dateRow.setHeightInPoints(25);
        Cell dateLabelCell = dateRow.createCell(lastCol - 1); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        dateLabelCell.setCellStyle(dateStyle);
        
        Cell dateValueCell = dateRow.createCell(lastCol); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        dateValueCell.setCellStyle(dateStyle);

        // 헤더 행 생성
        String[] headers = {"IP", "관리번호", "모델명", "설치장소"};
        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(25);
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < headers.length; j++) {
                Cell cell = headerRow.createCell(i * 4 + j);
                cell.setCellValue(headers[j]);
                cell.setCellStyle(headerStyle);
            }
        }

        // IP 대역별로 데이터 추가
        int currentRow = 3;
        List<String> sortedOctets = devicesByOctet.keySet().stream()
            .sorted((a, b) -> Integer.parseInt(a) - Integer.parseInt(b))
            .collect(Collectors.toList());

        for (String octet : sortedOctets) {
            // IP 대역 구분선 추가
            Row sectionRow = sheet.createRow(currentRow++);
            sectionRow.setHeightInPoints(25);
            Cell sectionCell = sectionRow.createCell(0);
            sectionCell.setCellValue("IP 대역: 10." + octet + ".36.x");
            sectionCell.setCellStyle(sectionHeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(currentRow - 1, currentRow - 1, 0, 15));

            // IP 대역별 데이터 매핑
            Map<Integer, Device> deviceMap = devicesByOctet.get(octet).stream()
                .collect(Collectors.toMap(
                    d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                    d -> d,
                    (existing, replacement) -> existing
                ));

            // 데이터 행 채우기 (1-254 범위)
            int rowsPerGroup = 64;
            for (int i = 0; i < rowsPerGroup; i++) {
                Row dataRow = sheet.createRow(currentRow++);
                dataRow.setHeightInPoints(20);

                // 4개 그룹에 대해 처리
                for (int group = 0; group < 4; group++) {
                    int ipNumber = i + 1 + (group * rowsPerGroup);
                    if (ipNumber > 254) continue;

                    int baseCol = group * 4;
                    Device device = deviceMap.get(ipNumber);
                    CellStyle style = (ipNumber >= 245 && ipNumber <= 254) ? warningStyle : dataStyle;

                    // IP 번호
                    Cell ipCell = dataRow.createCell(baseCol);
                    ipCell.setCellValue(ipNumber);
                    ipCell.setCellStyle(style);

                    // 나머지 정보
                    for (int j = 1; j < 4; j++) {
                        Cell cell = dataRow.createCell(baseCol + j);
                        cell.setCellStyle(style);
                        
                        if (device != null) {
                            switch (j) {
                                case 1: // 관리번호
                                    if (device.getManage() != null) {
                                        Manage manage = device.getManage();
                                        if (manage.getManageCate() != null) {
                                            String manageNo = manage.getManageCate();
                                            if (manage.getYear() != null) {
                                                manageNo += "-" + manage.getYear() + "-";
                                            } else {
                                                manageNo += "-";
                                            }
                                            if (manage.getManageNum() != null) {
                                                manageNo += String.format("%02d", manage.getManageNum());
                                            }
                                            cell.setCellValue(manageNo);
                                        }
                                    }
                                    break;
                                case 2: // 모델명
                                    if (device.getModelName() != null && !device.getModelName().trim().isEmpty()) {
                                        cell.setCellValue(device.getModelName().trim());
                                    }
                                    break;
                                case 3: // 설치장소
                                    if (device.getClassroom() != null && 
                                        device.getClassroom().getRoomName() != null && 
                                        !device.getClassroom().getRoomName().trim().isEmpty()) {
                                        cell.setCellValue(device.getClassroom().getRoomName().trim());
                                    }
                                    break;
                            }
                        }
                    }
                }
            }

            // IP 대역 사이에 빈 행 추가
            sheet.createRow(currentRow++);
        }

        // 열 너비 설정
        sheet.setColumnWidth(0, 2500);  // IP
        sheet.setColumnWidth(1, 3500);  // 관리번호
        sheet.setColumnWidth(2, 5000);  // 모델명
        sheet.setColumnWidth(3, 4500);  // 설치장소
        // 나머지 그룹도 동일하게 설정
        for (int i = 1; i < 4; i++) {
            sheet.setColumnWidth(i * 4, 2500);     // IP
            sheet.setColumnWidth(i * 4 + 1, 3500); // 관리번호
            sheet.setColumnWidth(i * 4 + 2, 5000); // 모델명
            sheet.setColumnWidth(i * 4 + 3, 4500); // 설치장소
        }
    }

    // 시트 생성 메서드
    private void createSheet(Workbook workbook, String secondOctet, List<Device> devices,
                           String dateStr,
                           CellStyle titleStyle, CellStyle headerStyle, 
                           CellStyle dataStyle, CellStyle warningStyle) {
        Sheet sheet = workbook.createSheet(secondOctet);

        // IP 번호로 매핑
        Map<Integer, Device> deviceMap = devices.stream()
            .collect(Collectors.toMap(
                d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                d -> d,
                (existing, replacement) -> existing
            ));

        // 제목 행 (1행)
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(40);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(String.format("IP대장업무용(10.%s.36.001-254)", secondOctet));
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 15));

        // 날짜 행 (2행)
        Row dateRow = sheet.createRow(1);
        dateRow.setHeightInPoints(25);
        Cell dateLabelCell = dateRow.createCell(14); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        
        Cell dateValueCell = dateRow.createCell(15); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        
        // 날짜 스타일 (오른쪽 정렬, 배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (흰색 유지)
        dateLabelCell.setCellStyle(dateStyle);
        dateValueCell.setCellStyle(dateStyle);

        // 헤더 행 (3행)
        String[] headers = {"IP", "관리번호", "모델명", "설치장소"};
        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(25);
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < headers.length; j++) {
                Cell cell = headerRow.createCell(i * 4 + j);
                cell.setCellValue(headers[j]);
                cell.setCellStyle(headerStyle);
            }
        }

        // 데이터 행 채우기 (1-254 범위)
        int rowsPerGroup = 64;
        for (int i = 0; i < rowsPerGroup; i++) {
            Row dataRow = sheet.createRow(i + 3);
            dataRow.setHeightInPoints(20);

            // 4개 그룹에 대해 처리
            for (int group = 0; group < 4; group++) {
                int ipNumber = i + 1 + (group * rowsPerGroup);
                if (ipNumber > 254) continue;

                int baseCol = group * 4;
                Device device = deviceMap.get(ipNumber);
                CellStyle style = (ipNumber >= 245 && ipNumber <= 254) ? warningStyle : dataStyle;

                // IP 번호
                Cell ipCell = dataRow.createCell(baseCol);
                ipCell.setCellValue(ipNumber);
                ipCell.setCellStyle(style);

                // 나머지 정보
                for (int j = 1; j < 4; j++) {
                    Cell cell = dataRow.createCell(baseCol + j);
                    cell.setCellStyle(style);
                    
                    if (device != null) {
                        switch (j) {
                            case 1: // 관리번호
                                if (device.getManage() != null) {
                                    Manage manage = device.getManage();
                                    if (manage.getManageCate() != null) {
                                        String manageNo = manage.getManageCate();
                                        if (manage.getYear() != null) {
                                            manageNo += "-" + manage.getYear() + "-";
                                        } else {
                                            manageNo += "-";
                                        }
                                        if (manage.getManageNum() != null) {
                                            manageNo += String.format("%02d", manage.getManageNum());
                                        }
                                        cell.setCellValue(manageNo);
                                    }
                                }
                                break;
                            case 2: // 모델명
                                if (device.getModelName() != null && !device.getModelName().trim().isEmpty()) {
                                    cell.setCellValue(device.getModelName().trim());
                                }
                                break;
                            case 3: // 설치장소
                                if (device.getClassroom() != null && 
                                    device.getClassroom().getRoomName() != null && 
                                    !device.getClassroom().getRoomName().trim().isEmpty()) {
                                    cell.setCellValue(device.getClassroom().getRoomName().trim());
                                }
                                break;
                        }
                    }
                }
            }
        }

        // 열 너비 설정
        sheet.setColumnWidth(0, 2500);  // IP
        sheet.setColumnWidth(1, 3500);  // 관리번호
        sheet.setColumnWidth(2, 5000);  // 모델명
        sheet.setColumnWidth(3, 4500);  // 설치장소
        // 나머지 그룹도 동일하게 설정
        for (int i = 1; i < 4; i++) {
            sheet.setColumnWidth(i * 4, 2500);     // IP
            sheet.setColumnWidth(i * 4 + 1, 3500); // 관리번호
            sheet.setColumnWidth(i * 4 + 2, 5000); // 모델명
            sheet.setColumnWidth(i * 4 + 3, 4500); // 설치장소
        }
    }
} 