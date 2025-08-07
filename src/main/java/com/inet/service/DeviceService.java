package com.inet.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.inet.entity.Device;
import com.inet.entity.School;
import com.inet.repository.DeviceRepository;
import com.inet.repository.SchoolRepository;
import com.inet.entity.Classroom;
import com.inet.repository.ClassroomRepository;
import com.inet.entity.Manage;
import com.inet.repository.ManageRepository;
import com.inet.entity.Operator;
import com.inet.service.OperatorService;
import com.inet.service.ClassroomService;
import com.inet.entity.Uid;
import com.inet.service.UidService;
import com.inet.entity.DeviceHistory;
import com.inet.entity.User;
import com.inet.service.DeviceHistoryService;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.IOException;
import java.io.OutputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.util.ArrayList;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final SchoolRepository schoolRepository;
    private final ClassroomRepository classroomRepository;
    private final OperatorService operatorService;
    private final ManageRepository manageRepository;
    private final ClassroomService classroomService;
    private final UidService uidService;
    private final DeviceHistoryService deviceHistoryService;
    
    @PersistenceContext
    private EntityManager entityManager;
    
    // Create
    public Device saveDevice(Device device) {
        System.out.println("Saving device: " + device);
        return deviceRepository.save(device);
    }
    
    // Read
    public List<Device> getAllDevices() {
        System.out.println("Getting all devices");
        return deviceRepository.findAll();
    }
    
    public List<Device> getDevicesBySchoolId(Long schoolId) {
        System.out.println("Getting devices by school id: " + schoolId);
        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        return deviceRepository.findBySchool(school);
    }
    
    public Optional<Device> getDeviceById(Long id) {
        System.out.println("Getting device by id: " + id);
        return deviceRepository.findById(id);
    }
    
    // Update
    public Device updateDevice(Device device) {
        System.out.println("Updating device: " + device);
        return deviceRepository.save(device);
    }
    
    /**
     * 장비 수정 시 히스토리 저장
     */
    @Transactional
    public void updateDeviceWithHistory(Device originalDevice, Device updatedDevice, User modifiedBy) {
        // 각 필드별로 변경사항 확인 및 히스토리 저장
        if (!equals(originalDevice.getType(), updatedDevice.getType())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "type", 
                originalDevice.getType(), updatedDevice.getType(), modifiedBy);
        }
        
        if (!equals(originalDevice.getManufacturer(), updatedDevice.getManufacturer())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "manufacturer", 
                originalDevice.getManufacturer(), updatedDevice.getManufacturer(), modifiedBy);
        }
        
        if (!equals(originalDevice.getModelName(), updatedDevice.getModelName())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "modelName", 
                originalDevice.getModelName(), updatedDevice.getModelName(), modifiedBy);
        }
        
        if (!equals(originalDevice.getPurchaseDate(), updatedDevice.getPurchaseDate())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "purchaseDate", 
                originalDevice.getPurchaseDate() != null ? originalDevice.getPurchaseDate().toString() : null,
                updatedDevice.getPurchaseDate() != null ? updatedDevice.getPurchaseDate().toString() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getIpAddress(), updatedDevice.getIpAddress())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "ipAddress", 
                originalDevice.getIpAddress(), updatedDevice.getIpAddress(), modifiedBy);
        }
        
        if (!equals(originalDevice.getPurpose(), updatedDevice.getPurpose())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "purpose", 
                originalDevice.getPurpose(), updatedDevice.getPurpose(), modifiedBy);
        }
        
        if (!equals(originalDevice.getSetType(), updatedDevice.getSetType())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "setType", 
                originalDevice.getSetType(), updatedDevice.getSetType(), modifiedBy);
        }
        
        if (!equals(originalDevice.getUnused(), updatedDevice.getUnused())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "unused", 
                originalDevice.getUnused() != null ? originalDevice.getUnused().toString() : null,
                updatedDevice.getUnused() != null ? updatedDevice.getUnused().toString() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getNote(), updatedDevice.getNote())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "note", 
                originalDevice.getNote(), updatedDevice.getNote(), modifiedBy);
        }
        
        // 연관 엔티티 변경사항 확인
        if (!equals(originalDevice.getSchool(), updatedDevice.getSchool())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "school", 
                originalDevice.getSchool() != null ? originalDevice.getSchool().getSchoolName() : null,
                updatedDevice.getSchool() != null ? updatedDevice.getSchool().getSchoolName() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getClassroom(), updatedDevice.getClassroom())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "classroom", 
                originalDevice.getClassroom() != null ? originalDevice.getClassroom().getRoomName() : null,
                updatedDevice.getClassroom() != null ? updatedDevice.getClassroom().getRoomName() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getOperator(), updatedDevice.getOperator())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "operator", 
                originalDevice.getOperator() != null ? originalDevice.getOperator().getName() : null,
                updatedDevice.getOperator() != null ? updatedDevice.getOperator().getName() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getManage(), updatedDevice.getManage())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "manage", 
                originalDevice.getManage() != null ? originalDevice.getManage().getManageNum().toString() : null,
                updatedDevice.getManage() != null ? updatedDevice.getManage().getManageNum().toString() : null, modifiedBy);
        }
        
        if (!equals(originalDevice.getUid(), updatedDevice.getUid())) {
            deviceHistoryService.saveDeviceHistory(updatedDevice, "uid", 
                originalDevice.getUid() != null ? originalDevice.getUid().getIdNumber().toString() : null,
                updatedDevice.getUid() != null ? updatedDevice.getUid().getIdNumber().toString() : null, modifiedBy);
        }
        
        // 장비 저장
        deviceRepository.save(updatedDevice);
    }
    
    /**
     * 두 객체가 같은지 비교 (null 안전)
     */
    private boolean equals(Object obj1, Object obj2) {
        if (obj1 == obj2) return true;
        if (obj1 == null || obj2 == null) return false;
        return obj1.equals(obj2);
    }
    
    // Delete
    @Transactional
    public void deleteDevice(Long id) {
        System.out.println("Deleting device with id: " + id);
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Device not found with id: " + id));
        
        // 장비의 운영자 참조를 null로 설정
        device.setOperator(null);
        deviceRepository.save(device);
        
        // 장비 삭제
        deviceRepository.deleteById(id);
    }

    // 페이징 + 학교 + 타입 + 교실 조건 검색
    public Page<Device> getDevices(Long schoolId, String type, Long classroomId, Pageable pageable) {
        if (schoolId != null && type != null && !type.isEmpty() && classroomId != null) {
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
            return deviceRepository.findBySchoolAndTypeAndClassroom(school, type, classroom, pageable);
        } else if (schoolId != null && type != null && !type.isEmpty()) {
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            return deviceRepository.findBySchoolAndType(school, type, pageable);
        } else if (schoolId != null && classroomId != null) {
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
            return deviceRepository.findBySchoolAndClassroom(school, classroom, pageable);
        } else if (schoolId != null) {
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            return deviceRepository.findBySchool(school, pageable);
        } else if (type != null && !type.isEmpty()) {
            return deviceRepository.findByType(type, pageable);
        } else if (classroomId != null) {
            Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
            return deviceRepository.findByClassroom(classroom, pageable);
        } else {
            return deviceRepository.findAll(pageable);
        }
    }

    // type 목록 조회
    public List<String> getAllTypes() {
        return deviceRepository.findDistinctTypes();
    }

    public List<Device> findBySchool(Long schoolId) {
        return deviceRepository.findBySchoolSchoolId(schoolId);
    }

    public List<Device> findByType(String type) {
        return deviceRepository.findByType(type);
    }

    public List<Device> findBySchoolAndType(Long schoolId, String type) {
        return deviceRepository.findBySchoolSchoolIdAndType(schoolId, type);
    }

    public List<Device> findAll() {
        return deviceRepository.findAll();
    }

    public void exportToExcel(List<Device> devices, OutputStream outputStream) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("장비 목록");
        
        // 1. 제목 스타일 (학교명 + 교실배치별 장비현황)
        CellStyle titleStyle = workbook.createCellStyle();
        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 14);
        titleStyle.setFont(titleFont);
        titleStyle.setAlignment(HorizontalAlignment.CENTER);
        
        // 2. 날짜 스타일
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        
        // 3. 헤더 스타일
        CellStyle headerStyle = workbook.createCellStyle();
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setBorderTop(BorderStyle.THIN);
        headerStyle.setBorderBottom(BorderStyle.THIN);
        headerStyle.setBorderLeft(BorderStyle.THIN);
        headerStyle.setBorderRight(BorderStyle.THIN);
        
        // 4. 데이터 스타일
        CellStyle dataStyle = workbook.createCellStyle();
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);
        
        // 학교명 가져오기 - 첫 번째 장비의 학교명 사용 (또는 선택된 학교명)
        String schoolName = "학교";
        if (!devices.isEmpty() && devices.get(0).getSchool() != null && devices.get(0).getSchool().getSchoolName() != null) {
            schoolName = devices.get(0).getSchool().getSchoolName();
        }
        
        // 현재 날짜 (작성일자)
        String today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        
        // 첫번째 행: 제목 (학교명 + 교실배치별 장비현황)
        Row titleRow = sheet.createRow(0);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(schoolName + " 교실배치별 장비현황");
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 13)); // A1:N1 (비고 컬럼까지 병합)
        
        // 두번째 행: 작성일자
        Row dateRow = sheet.createRow(1);
        Cell dateCell = dateRow.createCell(12); // M2 셀
        dateCell.setCellValue("작성일자");
        dateCell.setCellStyle(dateStyle);
        
        Cell todayCell = dateRow.createCell(13); // N2 셀
        todayCell.setCellValue(today);
        todayCell.setCellStyle(dateStyle);
        
        // 세번째 행: 헤더
        Row headerRow = sheet.createRow(2);
        String[] headers = {"No", "고유번호", "관리번호", "종류", "직위", "취급자", "제조사", "모델명", "도입일자", "현IP주소", "설치장소", "용도", "세트분류", "비고"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        // 데이터 행 추가
        int rowNum = 3; // 4번째 행부터 데이터 시작
        
        // 교실, 세트 타입, 담당자 순으로 정렬된 데이터 추가
        for (int i = 0; i < devices.size(); i++) {
            Device device = devices.get(i);
            Row row = sheet.createRow(rowNum++);
            
            // 각 열에 데이터 추가 및 스타일 적용
            for (int col = 0; col < 14; col++) {
                Cell cell = row.createCell(col);
                cell.setCellStyle(dataStyle);
                
                // 각 열의 데이터 설정
                switch (col) {
                    case 0: // No (순번)
                        cell.setCellValue(i + 1);
                        break;
                    case 1: // 고유번호
                        String uidDisplay = "";
                        if (device.getUid() != null && device.getSchool() != null) {
                            uidDisplay = device.getSchool().getSchoolId() + device.getUid().getDisplayId();
                        }
                        cell.setCellValue(uidDisplay);
                        break;
                    case 2: // 관리번호
                        String manageNo = "";
                        Manage manage = device.getManage();
                        if (manage != null) {
                            String cate = manage.getManageCate() != null ? manage.getManageCate() : "";
                            String year = manage.getYear() != null ? manage.getYear().toString() : "";
                            String num = manage.getManageNum() != null ? manage.getManageNum().toString() : "";
                            manageNo = (cate + (year.isEmpty() ? "" : ("-" + year)) + (num.isEmpty() ? "" : ("-" + num))).replaceAll("-$", "");
                        }
                        cell.setCellValue(manageNo);
                        break;
                    case 3: // 종류
                        cell.setCellValue(device.getType() != null ? device.getType() : "");
                        break;
                    case 4: // 직위
                        cell.setCellValue(device.getOperator() != null && device.getOperator().getPosition() != null ? device.getOperator().getPosition() : "");
                        break;
                    case 5: // 취급자
                        cell.setCellValue(device.getOperator() != null && device.getOperator().getName() != null ? device.getOperator().getName() : "");
                        break;
                    case 6: // 제조사
                        cell.setCellValue(device.getManufacturer() != null ? device.getManufacturer() : "");
                        break;
                    case 7: // 모델명
                        cell.setCellValue(device.getModelName() != null ? device.getModelName() : "");
                        break;
                    case 8: // 도입일자
                        cell.setCellValue(device.getPurchaseDate() != null ? device.getPurchaseDate().toString() : "");
                        break;
                    case 9: // 현IP주소
                        cell.setCellValue(device.getIpAddress() != null ? device.getIpAddress() : "");
                        break;
                    case 10: // 설치장소
                        cell.setCellValue(device.getClassroom() != null && device.getClassroom().getRoomName() != null ? device.getClassroom().getRoomName() : "");
                        break;
                    case 11: // 용도
                        cell.setCellValue(device.getPurpose() != null ? device.getPurpose() : "");
                        break;
                    case 12: // 세트분류
                        cell.setCellValue(device.getSetType() != null ? device.getSetType() : "");
                        break;
                    case 13: // 비고
                        cell.setCellValue(device.getNote() != null ? device.getNote() : "");
                        break;
                }
            }
        }

        // 컬럼 너비 조정
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
            // 최소 너비 보장
            int currentWidth = sheet.getColumnWidth(i);
            if (currentWidth < 3000) {
                sheet.setColumnWidth(i, 3000);
            }
        }

        // 첫 번째 컬럼(No)은 좁게 설정
        sheet.setColumnWidth(0, 1500);
        
        // 비고 컬럼(13번째)에 자동 줄바꿈 설정
        CellStyle wrappingStyle = workbook.createCellStyle();
        wrappingStyle.cloneStyleFrom(dataStyle);
        wrappingStyle.setWrapText(true);
        
        // 비고 컬럼에 줄바꿈 스타일 적용
        for (int i = 3; i < rowNum; i++) {
            Row row = sheet.getRow(i);
            if (row != null) {
                Cell noteCell = row.getCell(13);
                if (noteCell != null) {
                    // 기존 텍스트 가져오기
                    String noteText = noteCell.getStringCellValue();
                    // 15자마다 줄바꿈 처리
                    if (noteText != null && noteText.length() > 15) {
                        noteCell.setCellStyle(wrappingStyle);
                    }
                }
            }
        }

        workbook.write(outputStream);
        workbook.close();
    }

    public List<Device> findByClassroomRoomName(String roomName) {
        return deviceRepository.findByClassroomRoomName(roomName);
    }

    public List<Device> findBySchoolId(Long schoolId) {
        return deviceRepository.findBySchoolSchoolId(schoolId);
    }

    public List<Device> findBySchoolAndTypeAndClassroom(Long schoolId, String type, Long classroomId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        Classroom classroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
        return deviceRepository.findBySchoolAndTypeAndClassroom(school, type, classroom);
    }

    public List<Device> findBySchoolAndClassroom(Long schoolId, Long classroomId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        Classroom classroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
        return deviceRepository.findBySchoolAndClassroom(school, classroom);
    }

    public List<Device> findByClassroom(Long classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
        return deviceRepository.findByClassroom(classroom);
    }

    @Transactional
    public void saveDevicesFromExcel(MultipartFile file, Long schoolId) throws Exception {
        // 파일 확장자 검증
        String originalFilename = file.getOriginalFilename();
        System.out.println("엑셀 파일 업로드 시작: " + originalFilename);
        
        if (originalFilename == null || !(originalFilename.endsWith(".xls") || originalFilename.endsWith(".xlsx"))) {
            System.out.println("잘못된 파일 형식: " + originalFilename);
            throw new IllegalArgumentException("엑셀 파일(.xls 또는 .xlsx)만 업로드 가능합니다.");
        }

        // 파일 내용 검증
        if (file.isEmpty()) {
            System.out.println("빈 파일입니다: " + originalFilename);
            throw new IllegalArgumentException("빈 파일입니다. 내용이 있는 엑셀 파일을 업로드해주세요.");
        }

        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> {
                    System.out.println("학교를 찾을 수 없음. 학교 ID: " + schoolId);
                    return new IllegalArgumentException("학교를 찾을 수 없습니다.");
                });
        
        System.out.println("학교 정보: ID=" + school.getSchoolId() + ", 이름=" + school.getSchoolName());
        
        List<Device> devices = new ArrayList<>();
        try (InputStream is = file.getInputStream()) {
            Workbook workbook = WorkbookFactory.create(is);
            Sheet sheet = workbook.getSheetAt(0);
            int rowCount = 0;
            
            System.out.println("총 행 수: " + sheet.getPhysicalNumberOfRows());
            
            // 시트에 데이터가 없는 경우 확인
            if (sheet.getPhysicalNumberOfRows() == 0) {
                System.out.println("데이터가 없는 엑셀 파일입니다");
                throw new IllegalArgumentException("데이터가 없습니다. 최소한 1개 이상의 데이터행이 필요합니다.");
            }
            
            for (Row row : sheet) {
                rowCount++;
                
                try {
                    System.out.println(rowCount + "번째 행 처리 시작");
                    
                    // 빈 행 체크 - 타입(3번째 컬럼)이 비어있으면 스킵
                    if (isEmptyRow(row)) {
                        System.out.println(rowCount + "번째 행은 빈 행이므로 스킵합니다");
                        continue;
                    }
                    
                    // UID 정보 처리 (첫 번째 컬럼)
                    String uidInfo = null;
                    try {
                        uidInfo = getCellString(row.getCell(0));
                        System.out.println(rowCount + "번째 행 UID 정보: " + uidInfo);
                    } catch (Exception e) {
                        System.out.println(rowCount + "번째 행 UID 정보 처리 중 오류: " + e.getMessage());
                    }
                    
                    String uidCate = null;
                    
                    // 관리번호는 두 번째 컬럼(1)
                    String manageNo = null;
                    try {
                        manageNo = getCellString(row.getCell(1));
                        System.out.println(rowCount + "번째 행 관리번호: " + manageNo);
                    } catch (Exception e) {
                        System.out.println(rowCount + "번째 행 관리번호 처리 중 오류: " + e.getMessage());
                    }
                    
                    // Manage 엔티티 조회/생성 (관리번호가 없으면 null)
                    Manage manage = null;
                    if (manageNo != null && !manageNo.trim().isEmpty()) {
                        try {
                            ManageNumber mn = parseManageNo(manageNo);
                            System.out.println(rowCount + "번째 행 관리번호 파싱 결과: 카테고리=" + 
                                    mn.manageCate + ", 연도=" + mn.year + ", 번호=" + mn.manageNum);
                            
                            manage = manageRepository.findByManageCateAndYearAndManageNum(mn.manageCate, mn.year, mn.manageNum)
                                .map(existingManage -> {
                                    // 이미 존재하는 Manage 엔티티인 경우 학교 정보 업데이트
                                    if (existingManage.getSchool() == null) {
                                        existingManage.setSchool(school);
                                        return manageRepository.save(existingManage);
                                    }
                                    return existingManage;
                                })
                                .orElseGet(() -> {
                                    // 새로운 Manage 엔티티 생성
                                    Manage m = new Manage();
                                    m.setManageCate(mn.manageCate);
                                    m.setYear(mn.year);
                                    m.setManageNum(mn.manageNum);
                                    m.setSchool(school); // 학교 정보 설정
                                    return manageRepository.save(m);
                                });
                            
                            System.out.println(rowCount + "번째 행 Manage 엔티티 처리 완료: ID=" + manage.getManageId());
                        } catch (Exception e) {
                            System.out.println(rowCount + "번째 행 관리번호 형식 오류: " + manageNo + ", " + e.getMessage());
                            // 특정 행의 관리번호 오류를 알림
                            throw new IllegalArgumentException(rowCount + "번째 행의 관리번호 형식이 잘못되었습니다: " + manageNo);
                        }
                    }
                    
                    // 타입 정보 (세 번째 컬럼)
                    String type = null;
                    try {
                        type = getCellString(row.getCell(2));
                        System.out.println(rowCount + "번째 행 장비 타입: " + type);
                    } catch (Exception e) {
                        System.out.println(rowCount + "번째 행 장비 타입 처리 중 오류: " + e.getMessage());
                    }
                    
                    // 유효한 타입이 없으면 구체적인 오류 메시지와 함께 예외 발생
                    if (type == null || type.trim().isEmpty()) {
                        System.out.println(rowCount + "번째 행 장비 타입 누락");
                        throw new IllegalArgumentException(rowCount + "번째 행에 장비 타입이 없습니다. 장비 타입은 필수 값입니다.");
                    }
                    
                    // 취급자 정보 (4번째와 5번째 컬럼)
                    final String operatorPosition = getCellString(row.getCell(3)); // 직위
                    final String operatorName = getCellString(row.getCell(4)); // 취급자
                    Operator operator = null;
                    
                    try {
                        if (operatorName != null && !operatorName.isEmpty() && 
                            operatorPosition != null && !operatorPosition.isEmpty()) {
                            operator = operatorService.findByNameAndPositionAndSchool(operatorName, operatorPosition, school)
                                .orElseGet(() -> {
                                    Operator op = new Operator();
                                    op.setName(operatorName);
                                    op.setPosition(operatorPosition);
                                    op.setSchool(school);
                                    return operatorService.saveOperator(op);
                                });
                            System.out.println(rowCount + "번째 행 취급자 정보: " + operatorName + " (" + operatorPosition + ")");
                        }
                    } catch (Exception e) {
                        System.out.println(rowCount + "번째 행 취급자 정보 처리 중 오류: " + e.getMessage());
                        // 취급자 정보는 선택사항이므로 오류가 있어도 진행
                    }
                    
                    // 기타 정보
                    String manufacturer = null;
                    String modelName = null;
                    LocalDate purchaseDate = null;
                    String ipAddress = null;
                    
                    try {
                        manufacturer = getCellString(row.getCell(5));
                        modelName = getCellString(row.getCell(6));
                        
                        Cell dateCell = row.getCell(7); // 도입일자 컬럼
                        System.out.println("=== DATE CELL PROCESSING ===");
                        System.out.println("Row: " + rowCount + ", Cell index: 7");
                        System.out.println("Cell: " + dateCell);
                        System.out.println("Cell type: " + (dateCell != null ? dateCell.getCellType() : "null"));
                        System.out.println("Cell value: " + (dateCell != null ? getCellString(dateCell) : "null"));
                        
                        // 모든 셀 정보 출력 (디버깅용)
                        System.out.println("=== ALL CELLS INFO ===");
                        for (int i = 0; i < 13; i++) {
                            Cell cell = row.getCell(i);
                            System.out.println("Cell[" + i + "]: " + (cell != null ? getCellString(cell) : "null"));
                        }
                        
                        if (dateCell != null && dateCell.getCellType() != CellType.BLANK) {
                            purchaseDate = parseLocalDate(dateCell);
                            System.out.println(rowCount + "번째 행 도입일자 파싱 결과: " + purchaseDate);
                        } else {
                            System.out.println("도입일자 셀이 비어있습니다");
                        }
                        
                        ipAddress = getCellString(row.getCell(8));
                    } catch (Exception e) {
                        System.out.println(rowCount + "번째 행 기타 정보 처리 중 오류: " + e.getMessage());
                        // 선택적 정보이므로 진행
                    }
                    
                    // 교실 처리 (필수 항목)
                    String classroomName = null;
                    Classroom classroom = null;
                    
                    try {
                        classroomName = getCellString(row.getCell(9));
                        System.out.println(rowCount + "번째 행 설치장소(교실): " + classroomName);
                        
                        if (classroomName == null || classroomName.isBlank()) {
                            System.out.println(rowCount + "번째 행 설치장소(교실) 누락");
                            throw new IllegalArgumentException(rowCount + "번째 행에 설치장소(교실)가 지정되지 않았습니다. 설치장소는 필수 항목입니다.");
                        }
                        
                        // 학교별 교실 검색으로 수정
                        Optional<Classroom> existingClassroom = classroomService.findByRoomNameAndSchool(classroomName.trim(), school.getSchoolId());
                        if (existingClassroom.isPresent()) {
                            classroom = existingClassroom.get();
                            System.out.println(rowCount + "번째 행 기존 교실 사용: " + classroomName);
                        } else {
                            classroom = new Classroom();
                            classroom.setRoomName(classroomName.trim());
                            classroom.setSchool(school);
                            classroom.setXCoordinate(0);
                            classroom.setYCoordinate(0);
                            classroom.setWidth(100);
                            classroom.setHeight(100);
                            classroom = classroomService.saveClassroom(classroom);
                            System.out.println(rowCount + "번째 행 새 교실 생성: " + classroomName);
                        }
                    } catch (IllegalArgumentException e) {
                        throw e; // 이미 구체적인 오류 메시지가 있는 예외는 그대로 던짐
                    }
                    
                    // 기타 옵션 필드
                    String purpose = getCellString(row.getCell(10));
                    String setType = getCellString(row.getCell(11));
                    String note = getCellString(row.getCell(12));
                    
                    // UID 카테고리 결정 로직
                    if (uidInfo == null || uidInfo.trim().isEmpty()) {
                        // UID 정보가 비어있을 경우 자동 생성
                        if (type != null && !type.trim().isEmpty()) {
                            if ("데스크톱".equals(type)) {
                                // 데스크톱의 경우 manageCate에 따라 UID 카테고리 결정
                                if (manage != null && manage.getManageCate() != null) {
                                    String manageCate = manage.getManageCate();
                                    switch (manageCate) {
                                        case "업무":
                                            uidCate = "DW";
                                            break;
                                        case "교육":
                                            uidCate = "DE";
                                            break;
                                        case "기타":
                                            uidCate = "DK";
                                            break;
                                        case "컴퓨터교육":
                                            uidCate = "DC";
                                            break;
                                        case "학교구매":
                                            uidCate = "DS";
                                            break;
                                        case "기증품":
                                            uidCate = "DD";
                                            break;
                                        default:
                                            uidCate = "DW"; // 기본값
                                            break;
                                    }
                                } else {
                                    uidCate = "DW"; // 관리번호가 없는 경우 기본값
                                }
                            } else {
                                // 다른 장비 타입에 따라 UID 카테고리 결정
                                switch (type) {
                                    case "모니터":
                                        uidCate = "MO";
                                        break;
                                    case "프린터":
                                        uidCate = "PR";
                                        break;
                                    case "TV":
                                        uidCate = "TV";
                                        break;
                                    case "전자칠판":
                                        uidCate = "ID"; // IE에서 ID로 변경됨
                                        break;
                                    case "전자교탁":
                                        uidCate = "ED";
                                        break;
                                    case "DID":
                                        uidCate = "DI";
                                        break;
                                    case "태블릿":
                                        uidCate = "TB";
                                        break;
                                    case "프로젝트":
                                    case "프로젝터":
                                        uidCate = "PJ";
                                        break;
                                    default:
                                        uidCate = "ET"; // 기타 장비
                                        break;
                                }
                            }
                        } else {
                            uidCate = "ET"; // 타입 정보가 없는 경우 기본값
                        }
                    } else {
                        // UID 정보가 직접 입력된 경우 그대로 사용
                        uidCate = uidInfo;
                    }
                    
                    System.out.println(rowCount + "번째 행 최종 UID 카테고리: " + uidCate);
                    
                    // Device 객체 생성 및 기본 정보 설정
                    Device device = new Device();
                    device.setType(type);
                    device.setManufacturer(manufacturer);
                    device.setModelName(modelName);
                    device.setPurchaseDate(purchaseDate);
                    device.setIpAddress(ipAddress);
                    device.setPurpose(purpose);
                    device.setSetType(setType);
                    device.setNote(note);
                    device.setUnused(false);
                    device.setClassroom(classroom);
                    device.setSchool(school);
                    device.setManage(manage);
                    device.setOperator(operator);
                    
                    // 디바이스 저장 전에 UID 설정 - 필수 데이터 확인
                    if (uidCate != null && !uidCate.trim().isEmpty()) {
                        devices.add(device);
                        System.out.println(rowCount + "번째 행 장비 처리 완료");
                    } else {
                        System.out.println(rowCount + "번째 행 UID 카테고리 누락으로 장비 무시");
                    }
                } catch (Exception e) {
                    System.out.println(rowCount + "번째 행 처리 중 예외 발생: " + e.getMessage());
                    throw new IllegalArgumentException(rowCount + "번째 행 처리 중 오류가 발생했습니다: " + e.getMessage());
                }
            }
            
            // 모든 디바이스 추출 후, UID 카테고리별로 그룹화하여 ID 번호 부여
            Map<String, List<Device>> devicesByCate = devices.stream()
                    .collect(Collectors.groupingBy(device -> {
                        // Device에 설정된 UID 카테고리 얻기
                        String type = device.getType();
                        Manage manage = device.getManage();
                        
                        if ("데스크톱".equals(type)) {
                            if (manage != null && manage.getManageCate() != null) {
                                String manageCate = manage.getManageCate();
                                switch (manageCate) {
                                    case "업무": return "DW";
                                    case "교육": return "DE";
                                    case "기타": return "DK";
                                    case "컴퓨터교육": return "DC";
                                    case "학교구매": return "DS";
                                    case "기증품": return "DD";
                                    default: return "DW";
                                }
                            } else {
                                return "DW";
                            }
                        } else {
                            switch (type) {
                                case "모니터": return "MO";
                                case "프린터": return "PR";
                                case "TV": return "TV";
                                case "전자칠판": return "ID"; // IE에서 ID로 변경됨
                                case "전자교탁": return "ED";
                                case "DID": return "DI";
                                case "태블릿": return "TB";
                                case "프로젝트":
                                case "프로젝터": return "PJ";
                                default: return "ET";
                            }
                        }
                    }));
            
            System.out.println("UID 카테고리별 장비 수: " + devicesByCate.size() + "개 카테고리");
            
            // 각 카테고리별로 ID 번호 부여하고 UID 생성
            for (Map.Entry<String, List<Device>> entry : devicesByCate.entrySet()) {
                String cate = entry.getKey();
                List<Device> deviceList = entry.getValue();
                
                System.out.println("카테고리 '" + cate + "'의 장비 수: " + deviceList.size() + "개");
                
                // 각 장비 처리
                for (Device device : deviceList) {
                    // 현재 연도의 뒤 두 자리 가져오기 (예: 2025 -> 25)
                    int currentYear = LocalDate.now().getYear() % 100;
                    
                    // 제조일자가 있다면 해당 년도를 사용, 없으면 "xx" 사용
                    String mfgYear = device.getPurchaseDate() != null ? 
                            String.valueOf(device.getPurchaseDate().getYear() % 100) : 
                            "xx";
                    
                    // 학교 PK를 2자리 문자열로 변환 (예: 2 -> "02")
                    String schoolCode = String.format("%02d", school.getSchoolId());
                    
                    // 해당 카테고리, 학교, 제조년의 최대 ID 번호 조회
                    Long lastNumber = uidService.getLastIdNumberBySchoolAndMfgYear(school, cate, mfgYear);
                    
                    // 새 ID 번호 계산
                    Long idNumber = lastNumber + 1;
                    
                    // UID 생성 및 설정
                    Uid uid = uidService.createUidWithMfgYear(cate, idNumber, mfgYear, school);
                    device.setUid(uid);
                    
                    System.out.println("장비에 UID 설정: 카테고리=" + cate + 
                            ", 학교코드=" + schoolCode + 
                            ", 제조년=" + mfgYear + 
                            ", ID번호=" + String.format("%04d", idNumber) + 
                            " (표시: " + cate + schoolCode + mfgYear + String.format("%04d", idNumber) + ")");
                }
            }
            
            // 최종 저장
            int savedCount = deviceRepository.saveAll(devices).size();
            System.out.println("총 " + savedCount + "개의 장비 저장 완료");
        }
        
        // 메서드 끝에 추가 (return 문 바로 앞에)
        entityManager.flush();
        entityManager.clear();
    }

    private String getCellString(Cell cell) {
        if (cell == null) return null;
        
        try {
            switch (cell.getCellType()) {
                case STRING:
                    return cell.getStringCellValue().trim();
                case NUMERIC:
                    if (DateUtil.isCellDateFormatted(cell)) {
                        return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                    } else {
                        // 숫자 값이 날짜일 가능성 체크 (Excel 날짜는 1부터 시작)
                        double numValue = cell.getNumericCellValue();
                        if (numValue > 1 && numValue < 100000) { // Excel 날짜 범위
                            try {
                                // Excel 날짜를 LocalDate로 변환
                                java.util.Date date = DateUtil.getJavaDate(numValue);
                                java.time.LocalDate localDate = date.toInstant()
                                    .atZone(java.time.ZoneId.systemDefault())
                                    .toLocalDate();
                                return localDate.toString();
                            } catch (Exception e) {
                                System.out.println("Excel date conversion failed: " + e.getMessage());
                            }
                        }
                        // 일반 숫자 처리
                        if (numValue == Math.floor(numValue)) {
                            return String.format("%.0f", numValue);
                        } else {
                            return String.valueOf(numValue);
                        }
                    }
                case BOOLEAN:
                    return String.valueOf(cell.getBooleanCellValue());
                case FORMULA:
                    try {
                        // 엑셀 공식의 계산된 결과값을 가져옴
                        CellType cachedFormulaResultType = cell.getCachedFormulaResultType();
                        System.out.println("getCellString: FORMULA cell with cached result type = " + cachedFormulaResultType);
                        
                        if (cachedFormulaResultType == CellType.STRING) {
                            return cell.getStringCellValue().trim();
                        } else if (cachedFormulaResultType == CellType.NUMERIC) {
                            if (DateUtil.isCellDateFormatted(cell)) {
                                return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                            } else {
                                // 숫자 값이 날짜일 가능성 체크 (Excel 날짜는 1부터 시작)
                                double numValue = cell.getNumericCellValue();
                                if (numValue > 1 && numValue < 100000) { // Excel 날짜 범위
                                    try {
                                        // Excel 날짜를 LocalDate로 변환
                                        java.util.Date date = DateUtil.getJavaDate(numValue);
                                        java.time.LocalDate localDate = date.toInstant()
                                            .atZone(java.time.ZoneId.systemDefault())
                                            .toLocalDate();
                                        return localDate.toString();
                                    } catch (Exception e) {
                                        System.out.println("Excel date conversion failed: " + e.getMessage());
                                    }
                                }
                                // 일반 숫자 처리
                                if (numValue == Math.floor(numValue)) {
                                    return String.format("%.0f", numValue);
                                } else {
                                    return String.valueOf(numValue);
                                }
                            }
                        } else if (cachedFormulaResultType == CellType.BOOLEAN) {
                            return String.valueOf(cell.getBooleanCellValue());
                        } else if (cachedFormulaResultType == CellType.BLANK) {
                            return "";
                        }
                    } catch (Exception e) {
                        System.out.println("getCellString: Failed to process FORMULA cell: " + e.getMessage());
                        return "";
                    }
                    break;
                case BLANK:
                    return "";
                default:
                    return "";
            }
        } catch (Exception e) {
            System.out.println("getCellString: 셀 값 추출 중 오류 발생: " + e.getMessage());
            return "";
        }
        return "";
    }

    private static class ManageNumber {
        String manageCate;
        Integer year;
        Long manageNum;
        ManageNumber(String manageCate, Integer year, Long manageNum) {
            this.manageCate = manageCate;
            this.year = year;
            this.manageNum = manageNum;
        }
    }

    private ManageNumber parseManageNo(String manageNo) {
        String[] parts = manageNo.split("-");
        if (parts.length == 3) {
            return new ManageNumber(parts[0], Integer.parseInt(parts[1]), Long.parseLong(parts[2]));
        } else if (parts.length == 2) {
            return new ManageNumber(parts[0], null, Long.parseLong(parts[1]));
        } else {
            throw new IllegalArgumentException("관리번호 형식이 잘못되었습니다. 확인하여주세요. ('관리카테고리-일련번호' 또는 '관리카테고리-연도-일련번호' 형식이어야 합니다.)");
        }
    }

    private LocalDate parseLocalDate(Cell cell) {
        System.out.println("=== PARSE LOCAL DATE CALLED ===");
        System.out.println("Cell: " + cell);
        if (cell == null) {
            System.out.println("Cell is null");
            return null;
        }
        
        try {
            // 1. Excel의 날짜 형식인 경우 직접 변환 (가장 우선)
            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                System.out.println("Excel 날짜 형식 감지됨: " + cell.getLocalDateTimeCellValue());
                return cell.getLocalDateTimeCellValue().toLocalDate();
            }
            
            // 2. FORMULA 셀이면서 날짜 결과인 경우
            if (cell.getCellType() == CellType.FORMULA) {
                try {
                    CellType cachedType = cell.getCachedFormulaResultType();
                    if (cachedType == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                        System.out.println("Excel 날짜 공식 결과 감지됨: " + cell.getLocalDateTimeCellValue());
                        return cell.getLocalDateTimeCellValue().toLocalDate();
                    }
                } catch (Exception e) {
                    System.out.println("공식 셀 날짜 처리 중 오류: " + e.getMessage());
                }
            }
            
            // 3. 문자열로 변환하여 처리
            String value = getCellString(cell);
            if (value == null || value.isBlank()) return null;
            
            System.out.println("String date processing: " + value);
            System.out.println("Original cell type: " + cell.getCellType());
            System.out.println("Cell value: " + cell.toString());
            
            // 문자열 전처리 - 다양한 구분자와 형식 정규화
            value = value.trim()
                    .replace("년", "-").replace("월", "-").replace("일", "")
                    .replace(".", "-").replace("/", "-").replace(" ", "")
                    .replaceAll("--", "-").replaceAll("-$", "");
            
            // 다양한 날짜 형식 처리
            System.out.println("날짜 형식 매칭 시도: " + value);
            
            if (value.matches("\\d{4}-\\d{1,2}-\\d{1,2}")) {
                // YYYY-MM-DD 형식
                System.out.println("YYYY-MM-DD 형식 매칭됨: " + value);
                return LocalDate.parse(value, DateTimeFormatter.ofPattern("yyyy-M-d"));
            } else if (value.matches("\\d{4}-\\d{1,2}")) {
                // YYYY-MM 형식 (일은 1일로 설정)
                System.out.println("YYYY-MM 형식 매칭됨: " + value);
                return LocalDate.parse(value + "-01", DateTimeFormatter.ofPattern("yyyy-M-d"));
            } else if (value.matches("\\d{4}")) {
                // YYYY 형식 (월과 일은 1월 1일로 설정)
                System.out.println("YYYY 형식 매칭됨: " + value);
                return LocalDate.parse(value + "-01-01", DateTimeFormatter.ofPattern("yyyy-M-d"));
            } else if (value.matches("\\d{2}-\\d{1,2}")) {
                // YY-MM 형식 (현재 세기에 맞춰 연도 해석, 일은 1일로 설정)
                System.out.println("YY-MM 형식 매칭됨: " + value);
                int currentCentury = LocalDate.now().getYear() / 100 * 100;
                int year = Integer.parseInt(value.split("-")[0]);
                if (year > LocalDate.now().getYear() % 100) {
                    // 입력된 연도가 현재 연도의 뒤 두자리보다 크면 이전 세기로 해석
                    currentCentury -= 100;
                }
                return LocalDate.parse((currentCentury + year) + "-" + value.split("-")[1] + "-01", 
                        DateTimeFormatter.ofPattern("yyyy-M-d"));
            } else if (value.matches("\\d{2}")) {
                // YY 형식 (현재 세기에 맞춰 연도 해석, 월과 일은 1월 1일로 설정)
                System.out.println("YY 형식 매칭됨: " + value);
                int currentCentury = LocalDate.now().getYear() / 100 * 100;
                int year = Integer.parseInt(value);
                if (year > LocalDate.now().getYear() % 100) {
                    // 입력된 연도가 현재 연도의 뒤 두자리보다 크면 이전 세기로 해석
                    currentCentury -= 100;
                }
                return LocalDate.parse((currentCentury + year) + "-01-01", 
                        DateTimeFormatter.ofPattern("yyyy-M-d"));
            }
            
            // 4. 추가 날짜 형식 처리 (MM/DD/YYYY, DD/MM/YYYY 등)
            if (value.matches("\\d{1,2}/\\d{1,2}/\\d{4}")) {
                // MM/DD/YYYY 또는 DD/MM/YYYY 형식
                String[] parts = value.split("/");
                if (parts.length == 3) {
                    int first = Integer.parseInt(parts[0]);
                    int second = Integer.parseInt(parts[1]);
                    int year = Integer.parseInt(parts[2]);
                    
                    // 첫 번째 숫자가 12 이하면 월로 해석, 아니면 일로 해석
                    if (first <= 12) {
                        // MM/DD/YYYY 형식
                        return LocalDate.of(year, first, second);
                    } else {
                        // DD/MM/YYYY 형식
                        return LocalDate.of(year, second, first);
                    }
                }
            }
            
        } catch (DateTimeParseException | NumberFormatException e) {
            // 날짜 파싱 실패 시 null 반환 (오류 메시지 없이 계속 진행)
            System.out.println("날짜 파싱 오류: " + (cell != null ? getCellString(cell) : "null") + " - " + e.getMessage());
        } catch (Exception e) {
            System.out.println("날짜 처리 중 예상치 못한 오류: " + e.getMessage());
        }
        
        // 어떤 형식으로도 파싱할 수 없는 경우 null 반환 (오류 발생 없이 빈 값으로 처리)
        return null;
    }

    /**
     * 장비에 Uid를 설정합니다.
     * @param device 장비 객체
     * @param cate Uid 카테고리
     * @return 업데이트된 장비 객체
     */
    public Device setDeviceUid(Device device, String cate) {
        System.out.println("Creating new Uid with cate: " + cate + " for device: " + device);
        
        // 장비의 학교 정보 가져오기
        School school = device.getSchool();
        
        // 현재 연도의 뒤 두 자리 가져오기 (예: 2025 -> 25)
        int currentYear = LocalDate.now().getYear() % 100;
        
        // 제조일자가 있다면 해당 년도를 사용, 없으면 "xx" 사용
        String mfgYear = device.getPurchaseDate() != null ? 
                String.valueOf(device.getPurchaseDate().getYear() % 100) : 
                "xx";
        
        Uid uid;
        
        if (school != null) {
            // 학교 정보가 있으면 학교별로 Uid 생성
            uid = uidService.createNextUidWithMfgYear(cate, mfgYear, school);
        } else {
            // 학교 정보가 없는 경우는 기존 방식대로 처리
            uid = uidService.createNextUid(cate);
        }
        
        device.setUid(uid);
        return deviceRepository.save(device);
    }
    
    /**
     * 장비의 Uid를 특정 값으로 설정합니다.
     * @param device 장비 객체
     * @param cate Uid 카테고리
     * @param idNumber Uid 번호
     * @return 업데이트된 장비 객체
     */
    public Device setDeviceUidWithNumber(Device device, String cate, Long idNumber) {
        System.out.println("Setting Uid with cate: " + cate + ", idNumber: " + idNumber + " for device: " + device);
        
        // 장비의 학교 정보 가져오기
        School school = device.getSchool();
        
        // 현재 연도의 뒤 두 자리 가져오기 (예: 2025 -> 25)
        int currentYear = LocalDate.now().getYear() % 100;
        
        // 제조일자가 있다면 해당 년도를 사용, 없으면 "xx" 사용
        String mfgYear = device.getPurchaseDate() != null ? 
                String.valueOf(device.getPurchaseDate().getYear() % 100) : 
                "xx";
        
        Uid uid;
        
        if (school != null) {
            // 학교별로 Uid 조회 또는 생성
            uid = uidService.findBySchoolAndCateAndMfgYearAndIdNumber(school, cate, mfgYear, idNumber)
                    .orElseGet(() -> uidService.createUidWithMfgYear(cate, idNumber, mfgYear, school));
        } else {
            // 학교 정보가 없으면 기존 방식대로 처리
            uid = uidService.getUidByCateAndIdNumber(cate, idNumber)
                    .orElseGet(() -> uidService.createUid(cate, idNumber));
        }
        
        device.setUid(uid);
        return deviceRepository.save(device);
    }

    // 빈 행 여부 체크
    private boolean isEmptyRow(Row row) {
        // 최소한 타입(3번째 컬럼)은 있어야 함
        Cell typeCell = row.getCell(2);
        if (typeCell == null) return true;
        
        String typeValue = getCellString(typeCell);
        if (typeValue == null || typeValue.trim().isEmpty()) return true;
        
        // 최소한 하나의 다른 컬럼에 데이터가 있어야 함
        boolean hasOtherData = false;
        for (int i = 0; i <= 12; i++) {
            if (i == 2) continue; // 타입 컬럼은 이미 체크함
            
            Cell cell = row.getCell(i);
            if (cell != null) {
                String value = getCellString(cell);
                if (value != null && !value.trim().isEmpty()) {
                    hasOtherData = true;
                    break; // 데이터가 있는 컬럼을 발견
                }
            }
        }
        
        // 타입은 있지만 다른 모든 컬럼이 비어있으면 빈 행으로 간주
        return !hasOtherData;
    }

    /**
     * 필터링된 장비 목록을 가져오는 메서드
     * @param schoolId 학교 ID (필터링할 경우)
     * @param type 장비 유형 (필터링할 경우)
     * @param classroomId 교실 ID (필터링할 경우)
     * @return 필터링된 장비 목록
     */
    public List<Device> findFiltered(Long schoolId, String type, Long classroomId) {
        if (schoolId != null && type != null && !type.isEmpty() && classroomId != null) {
            return findBySchoolAndTypeAndClassroom(schoolId, type, classroomId);
        } else if (schoolId != null && type != null && !type.isEmpty()) {
            return findBySchoolAndType(schoolId, type);
        } else if (schoolId != null && classroomId != null) {
            return findBySchoolAndClassroom(schoolId, classroomId);
        } else if (schoolId != null) {
            return findBySchool(schoolId);
        } else if (type != null && !type.isEmpty()) {
            return findByType(type);
        } else if (classroomId != null) {
            return findByClassroom(classroomId);
        } else {
            return findAll();
        }
    }

    public List<Device> findDevicesBySchool(School school) {
        return deviceRepository.findBySchool(school);
    }

    // 통계용 메서드들
    public long countAllDevices() {
        return deviceRepository.count();
    }
    
    public long countActiveDevices() {
        return deviceRepository.countByUnusedFalseOrUnusedIsNull();
    }

    public List<Device> findByClassroomName(String classroomName) {
        return deviceRepository.findByClassroomRoomName(classroomName);
    }

    public List<Device> findByClassroomNameAndType(String classroomName, String type) {
        return deviceRepository.findByClassroomRoomNameAndType(classroomName, type);
    }
} 