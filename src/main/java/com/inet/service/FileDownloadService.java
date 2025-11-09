package com.inet.service;

import com.inet.entity.School;
import com.inet.repository.DeviceRepository;
import com.inet.repository.FloorPlanRepository;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class FileDownloadService {

    private final DeviceService deviceService;
    private final DeviceRepository deviceRepository;
    private final WirelessApExcelExportService wirelessApExcelExportService;
    private final IpExcelExportService ipExcelExportService;
    private final PPTExportService pptExportService;
    private final FloorPlanRepository floorPlanRepository;
    private final SchoolService schoolService;

    public FileDownloadService(
            DeviceService deviceService,
            DeviceRepository deviceRepository,
            WirelessApExcelExportService wirelessApExcelExportService,
            IpExcelExportService ipExcelExportService,
            PPTExportService pptExportService,
            FloorPlanRepository floorPlanRepository,
            SchoolService schoolService
    ) {
        this.deviceService = deviceService;
        this.deviceRepository = deviceRepository;
        this.wirelessApExcelExportService = wirelessApExcelExportService;
        this.ipExcelExportService = ipExcelExportService;
        this.pptExportService = pptExportService;
        this.floorPlanRepository = floorPlanRepository;
        this.schoolService = schoolService;
    }

    public AvailabilityResponse getAvailability(Long schoolId) {
        boolean deviceExcel = deviceRepository.countBySchoolSchoolId(schoolId) > 0;
        boolean wirelessApExcel = wirelessApExcelExportService.hasWirelessAps(schoolId);
        boolean ipExcel = deviceExcel && ipExcelExportService.hasDevicesWithIp(schoolId);
        boolean floorPlanExists = !floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true).isEmpty();
        boolean deviceFloorPlan = floorPlanExists;
        boolean wirelessApFloorPlan = floorPlanExists && wirelessApExcel;

        return new AvailabilityResponse(
                deviceExcel,
                wirelessApExcel,
                ipExcel,
                deviceFloorPlan,
                wirelessApFloorPlan
        );
    }

    public byte[] createArchive(Long schoolId, List<DownloadFileType> selectedTypes) {
        if (selectedTypes == null || selectedTypes.isEmpty()) {
            throw new IllegalArgumentException("다운로드할 파일을 선택해주세요.");
        }

        School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("학교를 찾을 수 없습니다. (ID: " + schoolId + ")"));

        Map<DownloadFileType, byte[]> fileContents = new EnumMap<>(DownloadFileType.class);

        for (DownloadFileType type : selectedTypes) {
            Optional<byte[]> content = switch (type) {
                case DEVICE_LEDGER -> deviceService.generateDeviceLedgerExcel(schoolId);
                case WIRELESS_AP_SUMMARY -> wirelessApExcelExportService.generateSchoolExcel(schoolId);
                case IP_LEDGER -> ipExcelExportService.generateExcel(schoolId, null);
                case DEVICE_FLOORPLAN -> generateFloorPlanPpt(schoolId, "equipment");
                case WIRELESS_AP_FLOORPLAN -> generateFloorPlanPpt(schoolId, "wireless-ap");
            };

            content.ifPresent(bytes -> fileContents.put(type, bytes));
        }

        if (fileContents.isEmpty()) {
            throw new IllegalStateException("선택한 항목에 다운로드할 수 있는 데이터가 없습니다.");
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zipOutputStream = new ZipOutputStream(baos)) {

            for (Map.Entry<DownloadFileType, byte[]> entry : fileContents.entrySet()) {
                String filename = buildFilename(entry.getKey(), school.getSchoolName());
                ZipEntry zipEntry = new ZipEntry(filename);
                zipOutputStream.putNextEntry(zipEntry);
                zipOutputStream.write(entry.getValue());
                zipOutputStream.closeEntry();
            }

            zipOutputStream.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("ZIP 파일 생성 중 오류가 발생했습니다.", e);
        }
    }

    private Optional<byte[]> generateFloorPlanPpt(Long schoolId, String mode) {
        try {
            ByteArrayOutputStream outputStream = pptExportService.exportFloorPlanToPPT(schoolId, mode);
            return Optional.ofNullable(outputStream).map(ByteArrayOutputStream::toByteArray);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private String buildFilename(DownloadFileType type, String schoolName) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        return schoolName + "_" + type.getDisplayName() + "_" + timestamp + "." + type.getExtension();
    }

    public record AvailabilityResponse(
            boolean deviceExcelAvailable,
            boolean wirelessApSummaryExcelAvailable,
            boolean ipLedgerExcelAvailable,
            boolean deviceFloorPlanPptAvailable,
            boolean wirelessApFloorPlanPptAvailable
    ) {
    }

    public enum DownloadFileType {
        DEVICE_LEDGER("정보화장비_관리대장", "xlsx"),
        WIRELESS_AP_SUMMARY("무선AP_연도별_총괄표", "xlsx"),
        IP_LEDGER("IP대장", "xlsx"),
        DEVICE_FLOORPLAN("학교_평면도", "pptx"),
        WIRELESS_AP_FLOORPLAN("무선AP_평면도", "pptx");

        private final String displayName;
        private final String extension;

        DownloadFileType(String displayName, String extension) {
            this.displayName = displayName;
            this.extension = extension;
        }

        public String getDisplayName() {
            return displayName;
        }

        public String getExtension() {
            return extension;
        }

        public static DownloadFileType fromCode(String code) {
            return switch (code) {
                case "device-ledger" -> DEVICE_LEDGER;
                case "wireless-ap-summary" -> WIRELESS_AP_SUMMARY;
                case "ip-ledger" -> IP_LEDGER;
                case "device-floorplan" -> DEVICE_FLOORPLAN;
                case "wireless-ap-floorplan" -> WIRELESS_AP_FLOORPLAN;
                default -> throw new IllegalArgumentException("알 수 없는 다운로드 유형입니다: " + code);
            };
        }
    }
}

