package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.exception.BusinessException;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TemplateSheetParserTest {

    private final TemplateSheetParser parser = new TemplateSheetParser();

    private MockMultipartFile xlsx(String[] headers, String[][] dataRows) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Sheet1");
            Row headerRow = sheet.createRow(0);
            for (int c = 0; c < headers.length; c++) {
                headerRow.createCell(c).setCellValue(headers[c]);
            }
            for (int r = 0; r < dataRows.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < dataRows[r].length; c++) {
                    if (dataRows[r][c] != null) {
                        row.createCell(c).setCellValue(dataRows[r][c]);
                    }
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return new MockMultipartFile("file", "sheet.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
        }
    }

    @Test
    void parses_header_row_into_key_value_maps_per_data_row() throws IOException {
        var file = xlsx(new String[]{"product", "offer"}, new String[][]{
                {"Iced Coffee", "Buy 1 Get 1"},
                {"Cold Brew", "20% off"},
        });

        TemplateSheetParser.ParsedSheet result = parser.parse(file);

        assertThat(result.totalRows()).isEqualTo(2);
        assertThat(result.parsedRows()).isEqualTo(2);
        assertThat(result.truncated()).isFalse();
        assertThat(result.rows()).containsExactly(
                java.util.Map.of("product", "Iced Coffee", "offer", "Buy 1 Get 1"),
                java.util.Map.of("product", "Cold Brew", "offer", "20% off"));
    }

    @Test
    void skips_blank_cells_rather_than_including_empty_values() throws IOException {
        var file = xlsx(new String[]{"product", "price"}, new String[][]{
                {"Iced Coffee", null},
        });

        TemplateSheetParser.ParsedSheet result = parser.parse(file);

        assertThat(result.rows()).containsExactly(java.util.Map.of("product", "Iced Coffee"));
    }

    @Test
    void skips_a_fully_blank_row_entirely() throws IOException {
        var file = xlsx(new String[]{"product"}, new String[][]{
                {"Iced Coffee"},
                {null},
                {"Cold Brew"},
        });

        TemplateSheetParser.ParsedSheet result = parser.parse(file);

        assertThat(result.parsedRows()).isEqualTo(2);
    }

    @Test
    void reports_truncation_when_sheet_exceeds_max_rows_rather_than_dropping_silently() throws IOException {
        String[][] rows = new String[35][];
        for (int i = 0; i < rows.length; i++) {
            rows[i] = new String[]{"product " + i};
        }
        var file = xlsx(new String[]{"product"}, rows);

        TemplateSheetParser.ParsedSheet result = parser.parse(file);

        assertThat(result.totalRows()).isEqualTo(35);
        assertThat(result.parsedRows()).isEqualTo(TemplateSheetParser.MAX_ROWS);
        assertThat(result.truncated()).isTrue();
    }

    @Test
    void rejects_a_sheet_with_no_header_row() throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            workbook.createSheet("Sheet1");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            var file = new MockMultipartFile("file", "empty.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());

            assertThatThrownBy(() -> parser.parse(file)).isInstanceOf(BusinessException.class);
        }
    }

    @Test
    void rejects_a_corrupt_or_non_xlsx_upload_with_a_clean_error_not_a_raw_500() {
        var file = new MockMultipartFile("file", "not-a-sheet.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "not actually a zip".getBytes());

        assertThatThrownBy(() -> parser.parse(file)).isInstanceOf(BusinessException.class);
    }
}
