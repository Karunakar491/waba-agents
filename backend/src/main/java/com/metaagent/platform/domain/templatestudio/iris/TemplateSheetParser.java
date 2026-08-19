package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.exception.BusinessException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads a brand manager's loose sample-content spreadsheet for the
 * bulk-template-recommendation feature (2026-08-19): row 1 is headers,
 * every other row becomes a header->value map, blank cells skipped. No
 * fixed schema — whatever columns they happened to fill in (Iris does the
 * recommending, not this parser). Capped at MAX_ROWS so a huge sheet can't
 * blow up the chat-message tag; truncation is reported, never silent.
 */
@Component
public class TemplateSheetParser {

    static final int MAX_ROWS = 30;

    public record ParsedSheet(int totalRows, int parsedRows, boolean truncated, List<Map<String, String>> rows) {}

    public ParsedSheet parse(MultipartFile file) {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                throw new BusinessException("This sheet has no header row to read column names from.");
            }
            List<String> headers = readHeaders(headerRow);

            int firstDataRow = sheet.getFirstRowNum() + 1;
            int lastDataRow = sheet.getLastRowNum();
            int totalRows = Math.max(0, lastDataRow - firstDataRow + 1);

            List<Map<String, String>> rows = new ArrayList<>();
            for (int r = firstDataRow; r <= lastDataRow && rows.size() < MAX_ROWS; r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                Map<String, String> values = readRow(row, headers);
                if (!values.isEmpty()) {
                    rows.add(values);
                }
            }
            return new ParsedSheet(totalRows, rows.size(), totalRows > rows.size(), rows);
        } catch (IOException e) {
            throw new BusinessException("Could not read this file as a spreadsheet: " + e.getMessage());
        } catch (RuntimeException e) {
            // EL-caught gap (2026-08-19): a non-.xlsx or corrupt upload can throw a POI
            // runtime exception (e.g. OldFileFormatException, IllegalArgumentException on
            // a bad/non-zip stream) rather than IOException -- without this, that reached
            // the operator as a raw 500 instead of a clean, recoverable error.
            throw new BusinessException("This doesn't look like a valid .xlsx file: " + e.getMessage());
        }
    }

    private List<String> readHeaders(Row headerRow) {
        List<String> headers = new ArrayList<>();
        for (Cell cell : headerRow) {
            headers.add(cellText(cell));
        }
        return headers;
    }

    private Map<String, String> readRow(Row row, List<String> headers) {
        Map<String, String> values = new LinkedHashMap<>();
        for (int c = 0; c < headers.size(); c++) {
            String header = headers.get(c);
            if (header == null || header.isBlank()) {
                continue;
            }
            Cell cell = row.getCell(c);
            String text = cell == null ? "" : cellText(cell);
            if (!text.isBlank()) {
                values.put(header, text);
            }
        }
        return values;
    }

    private String cellText(Cell cell) {
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            double value = cell.getNumericCellValue();
            return value == Math.floor(value) ? String.valueOf((long) value) : String.valueOf(value);
        }
        return cell.toString().trim();
    }
}
