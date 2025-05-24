// static/dashboard_app/js/chartQ7.js

async function drawChartQ7(containerSelector, tooltipElement, dataPath) { // THÊM dataPath ở đây
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    if (!dataPath) {
        vizContainer.html("<p style='color:red;'>Lỗi: Đường dẫn dữ liệu (dataPath) cho biểu đồ Q7 không được cung cấp.</p>");
        console.error("Lỗi drawChartQ7: dataPath không được định nghĩa.");
        return; // Dừng hàm nếu không có dataPath
    }

    try {
        console.log(`drawChartQ7: Tải dữ liệu từ: ${dataPath}`); // Log để debug
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng. Vui lòng kiểm tra đường dẫn và nội dung file.`);
        }
        console.log("drawChartQ7: Dữ liệu đã tải thành công.", allData.length, "hàng.");

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = +d.Sales; // Chuyển Sales sang số
            // Đảm bảo cột segment tồn tại và không rỗng
            if (typeof d.segment === 'undefined' || d.segment === null || String(d.segment).trim() === "") {
                d.segment = "Không xác định";
            }
            // Đảm bảo cột Order ID tồn tại
            if (typeof d['Order ID'] === 'undefined' || d['Order ID'] === null || String(d['Order ID']).trim() === "") {
                // Log cảnh báo nếu cần, hoặc bỏ qua dòng này nếu Order ID là bắt buộc
            }
        });

        // Tính tổng Sales cho mỗi segment
        const totalSalesBySegment = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d.segment
        );

        // Đếm số Order ID duy nhất cho mỗi segment
        const uniqueOrdersBySegment = d3.rollup(allData,
            v => new Set(v.map(d => d['Order ID'])).size, // Đếm Order ID duy nhất
            d => d.segment
        );

        let dataForChart = Array.from(totalSalesBySegment, ([segmentKey, totalSales]) => {
            const uniqueOrderCount = uniqueOrdersBySegment.get(segmentKey) || 0;
            return {
                segment: segmentKey,
                Total_Sales: totalSales,
                Unique_Order_Count: uniqueOrderCount,
                Average_Order_Value: (uniqueOrderCount > 0) ? (totalSales / uniqueOrderCount) : 0
            };
        });

        // Lọc bỏ các segment không hợp lệ (ví dụ: không có đơn hàng)
        dataForChart = dataForChart.filter(d => d.Unique_Order_Count > 0 && d.segment !== "Không xác định");

        // Sắp xếp theo thứ tự mong muốn (Consumer, Corporate, Home Office) để màu sắc ổn định
        const segmentOrder = ["Consumer", "Corporate", "Home Office"];
        dataForChart.sort((a, b) => segmentOrder.indexOf(a.segment) - segmentOrder.indexOf(b.segment));

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Phân khúc hợp lệ để vẽ biểu đồ Q7. Vui lòng kiểm tra dữ liệu nguồn.</p>");
            return;
        }
        console.log("drawChartQ7: Dữ liệu đã xử lý cho biểu đồ:", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT ĐỨNG ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.95 : 500;
        const baseHeight = 400;

        const chartWidth = Math.max(300, baseWidth);
        const chartHeight = Math.max(250, baseHeight);

        const margin = { top: 50, right: 30, bottom: 70, left: 70 }; // Increase left margin for Y label

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Customer Segment)
        const x = d3.scaleBand()
            .range([0, width])
            .domain(dataForChart.map(d => d.segment))
            .padding(0.4);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
                .style("text-anchor", "middle")
                .style("font-size", "11px");

        svg.append("text") // X axis label
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom / 2 + 15)
            .style("font-size", "12px")
            .text("Phân khúc khách hàng");

        // Y Axis (Average Order Value)
        const yMaxAOV = d3.max(dataForChart, d => d.Average_Order_Value);
        const y = d3.scaleLinear()
            .domain([0, yMaxAOV > 0 ? yMaxAOV * 1.15 : 100]) // Add 15% padding, ensure domain is not [0,0]
            .range([height, 0]);

        const yAxis = svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("$,.0f"))); // Currency format, no decimals

        yAxis.append("text") // Y axis label
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20) // Adjust position
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "#333")
            .style("font-size", "12px")
            .text("Giá trị trung bình đơn hàng ($)");

        // Color Scale (Matches colors in Python and Q6)
        const colorsQ7 = ['#6574cd', '#fbb6ce', '#fdc9a9']; // In the order of segmentOrder
        const color = d3.scaleOrdinal()
            .domain(segmentOrder)
            .range(colorsQ7);

        // Draw bars
        const bars = svg.selectAll(".bar-q7-aov")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-q7-aov")
              .attr("x", d => x(d.segment))
              .attr("y", d => y(d.Average_Order_Value))
              .attr("width", x.bandwidth())
              .attr("height", d => Math.max(0, height - y(d.Average_Order_Value)))
              .attr("fill", d => color(d.segment))
              .style("cursor", "pointer");

        // Add value text on each bar
        svg.selectAll(".bar-value-q7")
            .data(dataForChart)
            .join("text")
            .attr("class", "bar-value-q7")
            .attr("x", d => x(d.segment) + x.bandwidth() / 2)
            .attr("y", d => y(d.Average_Order_Value) - 8) // Slightly above the bar
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#333")
            .text(d => `$${d.Average_Order_Value.toFixed(2)}`); // Display 2 decimal places

        // Tooltip
        const tooltipElement = d3.select(".visualization-tooltip"); // Lấy tooltip từ DOM
        bars
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Phân khúc: ${d.segment}</strong><br/>
                    Giá trị TB đơn hàng: $${d.Average_Order_Value.toFixed(2)}<br/>
                    (Tổng Sales: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}, ${d.Unique_Order_Count} đơn hàng)`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");

                d3.select(this).style("filter", "brightness(0.85)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Title for the chart
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 0 - (margin.top / 2) - 5) // Position title at the top, centered
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "600")
            .style("fill", "#333")
            .text("Giá trị trung bình đơn hàng theo phân khúc khách hàng"); // Added dynamic title
    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q7: ${error.message}</p>`);
        console.error("Lỗi drawChartQ7:", error);
    }
}