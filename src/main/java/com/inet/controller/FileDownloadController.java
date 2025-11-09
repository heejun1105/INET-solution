package com.inet.controller;

import com.inet.config.PermissionHelper;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.FileDownloadService;
import com.inet.service.FileDownloadService.AvailabilityResponse;
import com.inet.service.FileDownloadService.DownloadFileType;
import com.inet.service.UserService;
import com.inet.service.SchoolPermissionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.web.servlet.mvc.support.RedirectAttributesModelMap;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Controller
public class FileDownloadController {

    private final UserService userService;
    private final FileDownloadService fileDownloadService;
    private final PermissionHelper permissionHelper;
    private final SchoolPermissionService schoolPermissionService;

    public FileDownloadController(
            UserService userService,
            FileDownloadService fileDownloadService,
            PermissionHelper permissionHelper,
            SchoolPermissionService schoolPermissionService
    ) {
        this.userService = userService;
        this.fileDownloadService = fileDownloadService;
        this.permissionHelper = permissionHelper;
        this.schoolPermissionService = schoolPermissionService;
    }

    @GetMapping("/file-download")
    public String view(Model model, RedirectAttributes redirectAttributes, HttpServletRequest request) {
        User user = getAuthenticatedUser();
        if (user == null) {
            return "redirect:/login";
        }

        if (permissionHelper.checkFeaturePermission(user, Feature.SUBMISSION_FILES, redirectAttributes) == null) {
            return "redirect:/";
        }

        permissionHelper.addPermissionAttributes(user, model);
        var accessibleSchools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", accessibleSchools);
        model.addAttribute("hasAccessibleSchools", !accessibleSchools.isEmpty());
        return "file-download/index";
    }

    @GetMapping("/file-download/options")
    @ResponseBody
    public ResponseEntity<AvailabilityResponse> getAvailability(@RequestParam Long schoolId) {
        User user = getAuthenticatedUser();
        if (!hasSchoolPermission(user, schoolId)) {
            return ResponseEntity.status(403).build();
        }
        AvailabilityResponse response = fileDownloadService.getAvailability(schoolId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/file-download/download")
    public ResponseEntity<byte[]> download(@RequestBody DownloadRequest requestBody) {
        User user = getAuthenticatedUser();
        if (!hasSchoolPermission(user, requestBody.getSchoolId())) {
            return ResponseEntity.status(403).build();
        }

        List<String> typeCodes = Optional.ofNullable(requestBody.getTypes())
                .orElse(List.of());
        if (typeCodes.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<DownloadFileType> downloadTypes = typeCodes.stream()
                .map(DownloadFileType::fromCode)
                .collect(Collectors.toList());

        byte[] archive = fileDownloadService.createArchive(requestBody.getSchoolId(), downloadTypes);

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "파일_다운로드_" + timestamp + ".zip";
        String encodedFilename = org.springframework.web.util.UriUtils.encode(filename, java.nio.charset.StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename);
        headers.setContentLength(archive.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(archive);
    }

    private boolean hasSchoolPermission(User user, Long schoolId) {
        if (user == null || schoolId == null) {
            return false;
        }
        RedirectAttributesModelMap dummyAttributes = new RedirectAttributesModelMap();
        return permissionHelper.checkSchoolPermission(user, Feature.SUBMISSION_FILES, schoolId, dummyAttributes) != null;
    }

    private User getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() ||
                authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userService.findByUsername(authentication.getName()).orElse(null);
    }

    @Getter
    @Setter
    public static class DownloadRequest {
        private Long schoolId;
        private List<String> types;
    }
}

