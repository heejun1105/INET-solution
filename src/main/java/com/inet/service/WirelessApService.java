package com.inet.service;

import com.inet.entity.WirelessAp;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.repository.WirelessApRepository;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class WirelessApService {
    private static final Logger log = LoggerFactory.getLogger(WirelessApService.class);
    
    private final WirelessApRepository wirelessApRepository;
    private final ClassroomService classroomService;
    private final WirelessApHistoryService wirelessApHistoryService;
    
    public WirelessApService(WirelessApRepository wirelessApRepository,
                           ClassroomService classroomService,
                           WirelessApHistoryService wirelessApHistoryService) {
        this.wirelessApRepository = wirelessApRepository;
        this.classroomService = classroomService;
        this.wirelessApHistoryService = wirelessApHistoryService;
    }

    // 모든 무선 AP 조회
    public List<WirelessAp> getAllWirelessAps() {
        return wirelessApRepository.findAll();
    }

    // 학교별 무선 AP 조회 (교실명 순으로 정렬)
    public List<WirelessAp> getWirelessApsBySchool(School school) {
        return wirelessApRepository.findBySchoolOrderByLocationRoomNameAsc(school);
    }

    // ID로 무선 AP 조회
    public Optional<WirelessAp> getWirelessApById(Long id) {
        return wirelessApRepository.findById(id);
    }

    // 무선 AP 저장
    public WirelessAp saveWirelessAp(WirelessAp wirelessAp) {
        return wirelessApRepository.save(wirelessAp);
    }
    
    /**
     * 무선AP 수정 시 히스토리 저장
     */
    @Transactional
    public void updateWirelessApWithHistory(WirelessAp updatedWirelessAp, User modifiedBy) {
        log.info("=== 무선AP 수정 히스토리 저장 시작 ===");
        log.info("무선AP ID: {}", updatedWirelessAp.getAPId());
        log.info("수정자: {}", modifiedBy.getName());
        
        // 데이터베이스에서 원본 무선AP 정보를 다시 조회 (JPA 영속성 컨텍스트 문제 방지)
        WirelessAp originalWirelessAp = wirelessApRepository.findById(updatedWirelessAp.getAPId())
                .orElseThrow(() -> new RuntimeException("원본 무선AP를 찾을 수 없습니다: " + updatedWirelessAp.getAPId()));
        
        log.info("원본 무선AP (DB에서 조회): location={}, manufacturer={}, model={}", 
                originalWirelessAp.getLocation() != null ? originalWirelessAp.getLocation().getRoomName() : null, 
                originalWirelessAp.getManufacturer(), originalWirelessAp.getModel());
        log.info("수정된 무선AP: location={}, manufacturer={}, model={}", 
                updatedWirelessAp.getLocation() != null ? updatedWirelessAp.getLocation().getRoomName() : null, 
                updatedWirelessAp.getManufacturer(), updatedWirelessAp.getModel());
        
        int changeCount = 0;
        
        // 각 필드별로 변경사항 확인 및 히스토리 저장
        if (!equals(originalWirelessAp.getLocation() != null ? originalWirelessAp.getLocation().getRoomName() : null, 
                   updatedWirelessAp.getLocation() != null ? updatedWirelessAp.getLocation().getRoomName() : null)) {
            changeCount++;
            log.info("Location 변경: {} -> {}", 
                    originalWirelessAp.getLocation() != null ? originalWirelessAp.getLocation().getRoomName() : null, 
                    updatedWirelessAp.getLocation() != null ? updatedWirelessAp.getLocation().getRoomName() : null);
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "location", 
                originalWirelessAp.getLocation() != null ? originalWirelessAp.getLocation().getRoomName() : null, 
                updatedWirelessAp.getLocation() != null ? updatedWirelessAp.getLocation().getRoomName() : null, modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getManufacturer(), updatedWirelessAp.getManufacturer())) {
            changeCount++;
            log.info("Manufacturer 변경: {} -> {}", originalWirelessAp.getManufacturer(), updatedWirelessAp.getManufacturer());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "manufacturer", 
                originalWirelessAp.getManufacturer(), updatedWirelessAp.getManufacturer(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getModel(), updatedWirelessAp.getModel())) {
            changeCount++;
            log.info("Model 변경: {} -> {}", originalWirelessAp.getModel(), updatedWirelessAp.getModel());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "model", 
                originalWirelessAp.getModel(), updatedWirelessAp.getModel(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getMacAddress(), updatedWirelessAp.getMacAddress())) {
            changeCount++;
            log.info("MacAddress 변경: {} -> {}", originalWirelessAp.getMacAddress(), updatedWirelessAp.getMacAddress());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "macAddress", 
                originalWirelessAp.getMacAddress(), updatedWirelessAp.getMacAddress(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getNewLabelNumber(), updatedWirelessAp.getNewLabelNumber())) {
            changeCount++;
            log.info("NewLabelNumber 변경: {} -> {}", originalWirelessAp.getNewLabelNumber(), updatedWirelessAp.getNewLabelNumber());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "newLabelNumber", 
                originalWirelessAp.getNewLabelNumber(), updatedWirelessAp.getNewLabelNumber(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getDeviceNumber(), updatedWirelessAp.getDeviceNumber())) {
            changeCount++;
            log.info("DeviceNumber 변경: {} -> {}", originalWirelessAp.getDeviceNumber(), updatedWirelessAp.getDeviceNumber());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "deviceNumber", 
                originalWirelessAp.getDeviceNumber(), updatedWirelessAp.getDeviceNumber(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getClassroomType(), updatedWirelessAp.getClassroomType())) {
            changeCount++;
            log.info("ClassroomType 변경: {} -> {}", originalWirelessAp.getClassroomType(), updatedWirelessAp.getClassroomType());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "classroomType", 
                originalWirelessAp.getClassroomType(), updatedWirelessAp.getClassroomType(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getSpeed(), updatedWirelessAp.getSpeed())) {
            changeCount++;
            log.info("Speed 변경: {} -> {}", originalWirelessAp.getSpeed(), updatedWirelessAp.getSpeed());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "speed", 
                originalWirelessAp.getSpeed(), updatedWirelessAp.getSpeed(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getPrevLocation(), updatedWirelessAp.getPrevLocation())) {
            changeCount++;
            log.info("PrevLocation 변경: {} -> {}", originalWirelessAp.getPrevLocation(), updatedWirelessAp.getPrevLocation());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "prevLocation", 
                originalWirelessAp.getPrevLocation(), updatedWirelessAp.getPrevLocation(), modifiedBy);
        }
        
        if (!equals(originalWirelessAp.getPrevLabelNumber(), updatedWirelessAp.getPrevLabelNumber())) {
            changeCount++;
            log.info("PrevLabelNumber 변경: {} -> {}", originalWirelessAp.getPrevLabelNumber(), updatedWirelessAp.getPrevLabelNumber());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "prevLabelNumber", 
                originalWirelessAp.getPrevLabelNumber(), updatedWirelessAp.getPrevLabelNumber(), modifiedBy);
        }
        
        // APYear 비교 (LocalDate)
        if (!equals(originalWirelessAp.getAPYear(), updatedWirelessAp.getAPYear())) {
            changeCount++;
            log.info("APYear 변경: {} -> {}", originalWirelessAp.getAPYear(), updatedWirelessAp.getAPYear());
            wirelessApHistoryService.saveWirelessApHistory(updatedWirelessAp, "apYear", 
                originalWirelessAp.getAPYear() != null ? originalWirelessAp.getAPYear().toString() : null, 
                updatedWirelessAp.getAPYear() != null ? updatedWirelessAp.getAPYear().toString() : null, modifiedBy);
        }
        
        // 실제 데이터베이스 업데이트
        wirelessApRepository.save(updatedWirelessAp);
        
        log.info("=== 무선AP 수정 히스토리 저장 완료 ===");
        log.info("총 {}개 필드가 변경되었습니다.", changeCount);
    }
    
    /**
     * 두 값이 같은지 비교 (null 안전)
     */
    private boolean equals(Object obj1, Object obj2) {
        if (obj1 == null && obj2 == null) return true;
        if (obj1 == null || obj2 == null) return false;
        return obj1.equals(obj2);
    }

    // 무선 AP 삭제
    public void deleteWirelessAp(Long id) {
        wirelessApRepository.deleteById(id);
    }

    // 교실별 무선 AP 조회
    public List<WirelessAp> getWirelessApsByLocation(Classroom location) {
        return wirelessApRepository.findByLocation(location);
    }

    @Transactional
    public void saveWirelessApsFromExcel(MultipartFile file, School school) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("빈 파일입니다. 내용이 있는 엑셀 파일을 업로드해주세요.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !(originalFilename.endsWith(".xls") || originalFilename.endsWith(".xlsx"))) {
            throw new IllegalArgumentException("엑셀 파일(.xls 또는 .xlsx)만 업로드 가능합니다.");
        }

        List<WirelessAp> wirelessAps = new ArrayList<>();
        int processedRows = 0;
        int skippedRows = 0;
        
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            log.info("Processing Excel file: {} with {} rows", originalFilename, sheet.getLastRowNum() + 1);
            
            // 첫 번째 행부터 데이터로 처리
            for (int i = 0; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    log.debug("Row {} is null, skipping", i);
                    skippedRows++;
                    continue;
                }

                // 첫 번째 셀(location)이 비어있으면 빈 행으로 간주하고 건너뛰기
                String locationValue = getCellValueAsString(row.getCell(0));
                if (locationValue == null || locationValue.trim().isEmpty()) {
                    log.debug("Row {} has empty location, skipping", i);
                    skippedRows++;
                    continue;
                }

                log.debug("Processing row {}: location = '{}'", i, locationValue);

                WirelessAp ap = new WirelessAp();
                
                // school 설정
                ap.setSchool(school);
                log.debug("Set school: {}", school.getSchoolName());
                
                // location (Classroom) 처리
                Optional<Classroom> existingClassroom = classroomService.findByRoomNameAndSchool(locationValue, school.getSchoolId());
                Classroom classroom;
                
                if (existingClassroom.isPresent()) {
                    classroom = existingClassroom.get();
                    log.debug("Found existing classroom: {}", classroom.getRoomName());
                } else {
                    // 새로운 Classroom 생성 시 school도 함께 설정
                    classroom = new Classroom();
                    classroom.setRoomName(locationValue);
                    classroom.setSchool(school);
                    classroom.setXCoordinate(0);
                    classroom.setYCoordinate(0);
                    classroom.setWidth(100);
                    classroom.setHeight(100);
                    classroom = classroomService.saveClassroom(classroom);
                    log.debug("Created new classroom: {}", classroom.getRoomName());
                }
                ap.setLocation(classroom);

                // 새로운 순서에 맞게 필드 설정
                // location(0), classroomType(1), newLabelNumber(2), deviceNumber(3), APYear(4), manufacturer(5), model(6), macAddress(7), prevLocation(8), prevLabelNumber(9), speed(10)
                ap.setClassroomType(getCellValueAsString(row.getCell(1))); // 교실구분
                ap.setNewLabelNumber(getCellValueAsString(row.getCell(2))); // 신규라벨번호
                ap.setDeviceNumber(getCellValueAsString(row.getCell(3))); // 장비번호
                
                LocalDate apYear = getCellValueAsLocalDate(row.getCell(4)); // 도입년도
                ap.setAPYear(apYear);
                log.debug("Row {}: APYear = {}", i, apYear);
                
                ap.setManufacturer(getCellValueAsString(row.getCell(5))); // 제조사
                ap.setModel(getCellValueAsString(row.getCell(6))); // 모델
                ap.setMacAddress(getCellValueAsString(row.getCell(7))); // mac주소
                ap.setPrevLocation(getCellValueAsString(row.getCell(8))); // 기존위치
                ap.setPrevLabelNumber(getCellValueAsString(row.getCell(9))); // 기존라벨번호
                ap.setSpeed(getCellValueAsString(row.getCell(10))); // 속도

                wirelessAps.add(ap);
                processedRows++;
                log.debug("Added WirelessAp for row {}", i);
            }
        }

        log.info("Excel processing completed. Processed: {}, Skipped: {}, Total to save: {}", 
                processedRows, skippedRows, wirelessAps.size());
        
        if (!wirelessAps.isEmpty()) {
            wirelessApRepository.saveAll(wirelessAps);
            log.info("Successfully saved {} wireless APs to database", wirelessAps.size());
        } else {
            log.warn("No valid wireless AP data found in Excel file");
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                return String.valueOf((long) cell.getNumericCellValue());
            case FORMULA:
                try {
                    CellType cachedFormulaResultType = cell.getCachedFormulaResultType();
                    if (cachedFormulaResultType == CellType.STRING) {
                        return cell.getStringCellValue();
                    } else if (cachedFormulaResultType == CellType.NUMERIC) {
                        return String.valueOf((long) cell.getNumericCellValue());
                    } else if (cachedFormulaResultType == CellType.BLANK) {
                        return null;
                    }
                } catch (Exception e) {
                    log.warn("getCellValueAsString: Failed to process FORMULA cell: {}", e.getMessage());
                    return null;
                }
                break;
            case BLANK:
                return null;
            default:
                return null;
        }
        return null;
    }

    private Integer getCellValueAsInteger(Cell cell) {
        if (cell == null) return null;
        
        switch (cell.getCellType()) {
            case NUMERIC:
                return (int) cell.getNumericCellValue();
            case STRING:
                try {
                    return Integer.parseInt(cell.getStringCellValue());
                } catch (NumberFormatException e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private LocalDate getCellValueAsLocalDate(Cell cell) {
        if (cell == null) {
            log.debug("getCellValueAsLocalDate: cell is null");
            return null;
        }
        
        Integer year = null;
        String originalValue = "";
        
        switch (cell.getCellType()) {
            case NUMERIC:
                year = (int) cell.getNumericCellValue();
                originalValue = String.valueOf(year);
                log.debug("getCellValueAsLocalDate: NUMERIC value = {}", originalValue);
                break;
            case STRING:
                try {
                    originalValue = cell.getStringCellValue().trim();
                    log.debug("getCellValueAsLocalDate: STRING value = '{}'", originalValue);
                    
                    String yearStr = originalValue;
                    // '2022년' 형태의 문자열 처리
                    if (yearStr.endsWith("년")) {
                        yearStr = yearStr.substring(0, yearStr.length() - 1);
                        log.debug("getCellValueAsLocalDate: Removed '년' suffix, yearStr = '{}'", yearStr);
                    }
                    year = Integer.parseInt(yearStr);
                    log.debug("getCellValueAsLocalDate: Parsed year = {}", year);
                } catch (NumberFormatException e) {
                    log.warn("getCellValueAsLocalDate: Failed to parse '{}' as year: {}", originalValue, e.getMessage());
                    return null;
                }
                break;
            case FORMULA:
                try {
                    // 엑셀 공식의 계산된 결과값을 가져옴
                    CellType cachedFormulaResultType = cell.getCachedFormulaResultType();
                    log.debug("getCellValueAsLocalDate: FORMULA cell with cached result type = {}", cachedFormulaResultType);
                    
                    if (cachedFormulaResultType == CellType.NUMERIC) {
                        year = (int) cell.getNumericCellValue();
                        originalValue = "FORMULA->" + year;
                        log.debug("getCellValueAsLocalDate: FORMULA NUMERIC result = {}", year);
                    } else if (cachedFormulaResultType == CellType.STRING) {
                        originalValue = cell.getStringCellValue().trim();
                        log.debug("getCellValueAsLocalDate: FORMULA STRING result = '{}'", originalValue);
                        
                        String yearStr = originalValue;
                        if (yearStr.endsWith("년")) {
                            yearStr = yearStr.substring(0, yearStr.length() - 1);
                        }
                        year = Integer.parseInt(yearStr);
                    } else if (cachedFormulaResultType == CellType.BLANK) {
                        log.debug("getCellValueAsLocalDate: FORMULA result is BLANK");
                        return null;
                    }
                } catch (Exception e) {
                    log.warn("getCellValueAsLocalDate: Failed to process FORMULA cell: {}", e.getMessage());
                    return null;
                }
                break;
            case BLANK:
                log.debug("getCellValueAsLocalDate: BLANK cell");
                return null;
            default:
                log.debug("getCellValueAsLocalDate: Unsupported cell type = {}", cell.getCellType());
                return null;
        }
        
        if (year != null && year >= 1900 && year <= 2100) {
            LocalDate result = LocalDate.of(year, 1, 1);
            log.debug("getCellValueAsLocalDate: Successfully created LocalDate = {} from original value '{}'", result, originalValue);
            return result; // 년도만 있으면 1월 1일로 설정
        } else {
            log.warn("getCellValueAsLocalDate: Year {} is outside valid range (1900-2100)", year);
        }
        
        return null;
    }
} 