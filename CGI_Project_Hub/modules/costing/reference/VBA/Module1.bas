Attribute VB_Name = "Module1"
Sub Hide_TC_Rows()
    Dim ws As Worksheet
    Dim rng As Range, cell As Range
    Dim beginRow As Long
    Dim endRow As Long
    
    ' Set the worksheet where you want to hide rows
    Set ws = ThisWorkbook.Sheets("T&C")

    ' Set the range to check (Column L, rows 59 to 169)
    
    beginRow = Application.WorksheetFunction.Match("Hide/Show:", ws.Columns("L"), 0)
    endRow = Application.WorksheetFunction.Match("End", ws.Columns("L"), 0)
    Set rng = ws.Range("L" & beginRow & ":" & "L" & endRow)
    Application.Calculation = xlCalculationManual
    ws.Cells(1, 1).Value = 0
    ' Loop through each cell in the range
    For Each cell In rng
        ' Check if the cell value is "Hide"
        If cell.Value = "Hide" Then
            ' Hide the entire row
            cell.EntireRow.Hidden = True
        End If
    Next cell
    Application.Calculation = xlCalculationAutomatic
End Sub

Sub Hide_TCStandard_Rows()
    Dim ws As Worksheet
    Dim rng As Range, cell As Range
    Dim beginRow As Long
    Dim endRow As Long
    
    ' Set the worksheet where you want to hide rows
    Set ws = ThisWorkbook.Sheets("T&C Standard")

    ' Set the range to check (Column L, rows 59 to 169)
    
    beginRow = Application.WorksheetFunction.Match("Hide/Show:", ws.Columns("L"), 0)
    endRow = Application.WorksheetFunction.Match("End", ws.Columns("L"), 0)
    Set rng = ws.Range("L" & beginRow & ":" & "L" & endRow)
    Application.Calculation = xlCalculationManual
    ws.Cells(1, 1).Value = 0
    ' Loop through each cell in the range
    For Each cell In rng
        ' Check if the cell value is "Hide"
        If cell.Value = "Hide" Then
            ' Hide the entire row
            cell.EntireRow.Hidden = True
        End If
    Next cell
    Application.Calculation = xlCalculationAutomatic
End Sub

Sub GoToNamedRange(definedName As String)
    Dim targetSheet As Worksheet
    Dim targetRange As Range
    ' Activate the sheet and go to the specified named range
    On Error Resume Next
    Set targetRange = ThisWorkbook.Names(definedName).RefersToRange
    On Error GoTo 0
    
    Set targetSheet = targetRange.Worksheet
    targetSheet.Activate
    targetRange.Select
End Sub



