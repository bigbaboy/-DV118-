// chartQ4.js

// Đảm bảo hàm này nhận đủ 3 tham số: containerSelector, tooltipElement, và dataPath
async function drawChartQ4(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html("");
    
    // ĐÃ SỬA: Bỏ comment và thêm tiêu đề cụ thể cho biểu đồ này
    vizContainer.append("h4")
        .style("text-align", "center")
        .style("margin-bottom", "20px")
        .text("Biểu đồ Treemap: Top 10 Sản phẩm Doanh thu tại Philadelphia (Q4)");

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        const philaData = allData.filter(d => d.City === "Philadelphia" && d.Country === "United States");
        if (philaData.length === 0) { vizContainer.html("<p>Không có dữ liệu Philadelphia cho Q4.</p>"); return; }

        philaData.forEach(d => {
            d.Sales = +d.Sales; d.Profit = +d.Profit; d.Quantity = +d.Quantity;
            d.Discount = +d.Discount; d['Shipping Cost'] = +d['Shipping Cost'];
            // Thêm cột 'Product Name Short' nếu cần cho hiển thị trên ô
            d['Product Name Short'] = (d['Product Name'].length > 35) ? d['Product Name'].substring(0,32) + "..." : d['Product Name'];
        });
        
        const productDetails = d3.rollup(philaData,
             v => ({ 
                 Total_Sales: d3.sum(v, d => d.Sales), 
                 Total_Profit: d3.sum(v, d => d.Profit), 
                 Total_Quantity: d3.sum(v,d=>d.Quantity), 
                 Average_Discount: d3.mean(v,d=>d.Discount), 
                 Average_Shipping_Cost: d3.mean(v, d=>d['Shipping Cost']), 
                 'Sub-Category': v[0]['Sub-Category'],
                 'Product_Name_Original': v[0]['Product Name'], // Giữ tên đầy đủ cho tooltip
                 'Product_Name_Display': v[0]['Product Name Short'] // Tên rút gọn cho path/label
             }),
             d => d['Product Name'] // Key của rollup là Product Name đầy đủ
        );

        let topProductsArray = Array.from(productDetails, ([key_product_name, value]) => ({
            'name': value.Product_Name_Display, // Dùng cho path và label trên ô
            'fullName': value.Product_Name_Original, // Dùng cho tooltip
            'Sub_Category': value['Sub-Category'], 
            'value': value.Total_Sales, // Dùng cho kích thước ô (phải là 'value' cho d3.hierarchy().sum())
            'profit': value.Total_Profit,
            'profitMargin': (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0,
            'quantity': value.Total_Quantity, 
            'avgDiscount': (value.Average_Discount || 0) * 100, 
            'avgShippingCost': value.Average_Shipping_Cost || 0,
            // 'colorValue' sẽ là profitMargin
            'colorValue': (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0
        }));

        topProductsArray = topProductsArray.filter(d => d.value > 0) // Lọc theo 'value' (Total_Sales)
                                         .sort((a,b)=>b.value - a.value)
                                         .slice(0,10); // Lấy top 10

        if (topProductsArray.length === 0) { vizContainer.html("<p>Không có SP ở Phila cho Treemap (Q4).</p>"); return; }
        
        const hierarchyDataForTreemap = { name: "Top 10 Products Phila (D3)", children: topProductsArray };
        
        // --- BẮT ĐẦU CODE D3.JS VẼ TREEMAP ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const width = containerRect.width > 0 ? containerRect.width * 0.98 : 900;
        const height = 550;

        const root = d3.hierarchy(hierarchyDataForTreemap)
                         .sum(d => Math.max(0, d.value)) 
                         .sort((a, b) => (b.height - a.height) || (b.value - a.value)); // Sắp xếp để ô to ở góc

        d3.treemap().size([width, height]).paddingInner(2).paddingOuter(1).round(true)(root);

        const svg = vizContainer.append("svg")
            .attr("viewBox", [0, 0, width, height])
            .attr("width", width).attr("height", height)
            .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

        const profitMarginsTm = root.leaves().map(d => d.data.colorValue || 0);
        let minColorTm = d3.min(profitMarginsTm); let maxColorTm = d3.max(profitMarginsTm);
        if(minColorTm === maxColorTm){ minColorTm-=10; maxColorTm+=10;}
        if(minColorTm > 0 && maxColorTm > 0 && minColorTm !==undefined) minColorTm = -1;
        if(minColorTm < 0 && maxColorTm < 0 && maxColorTm !==undefined) maxColorTm = 1;
        if(minColorTm === undefined) minColorTm = -10;
        if(maxColorTm === undefined) maxColorTm = 10;

        const colorTm = d3.scaleDiverging(d3.interpolateRdYlGn).domain([minColorTm, 0, maxColorTm]);

        const node = svg.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        node.append("rect")
            .attr("fill", d => colorTm(d.data.colorValue || 0))
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0);
        
        node.append("foreignObject")
            .attr("x", 4).attr("y", 4)
            .attr("width", d => Math.max(0, (d.x1 - d.x0) - 8))
            .attr("height", d => Math.max(0, (d.y1 - d.y0) - 8))
          .append("xhtml:div")
            .style("font-size", "9px")
            .style("line-height", "1.15") // Điều chỉnh line-height
            .style("color", function(d_node) {
                const cVal = d_node.data.colorValue || 0;
                const hsl = d3.hsl(colorTm(cVal));
                return hsl.l > 0.55 ? '#333' : '#fff';
            })
            .style("overflow", "hidden").style("height", "100%").style("padding", "2px")
            .html(d_node => {
                const d = d_node.data;
                return `
                <div style="height:100%; display:flex; flex-direction:column; justify-content:flex-start;">
                    <strong>${d.name}</strong><br>
                    Doanh thu: $${(d.value || 0).toLocaleString(undefined, {maximumFractionDigits:0})}<br>
                    Lợi nhuận: $${(d.profit || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}<br>
                    Biên LN: ${(d.profitMargin || 0).toFixed(1)}%<br>
                    SL Bán: ${d.quantity || 'N/A'}<br>
                    CK TB: ${(d.avgDiscount || 0).toFixed(1)}%<br>
                    Phí Ship TB: $${(d.avgShippingCost || 0).toFixed(2)}
                </div>`;
            });
            
        node.on("mouseover", function(event, d_node) {
            const d = d_node.data;
            tooltipElement.transition().duration(100).style("opacity", .95);
            tooltipElement.html(
                `<strong>${d.fullName}</strong> (${d['Sub_Category'] || 'N/A'})<br/>
                 Doanh thu: $${(d.value || 0).toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                 Lợi nhuận: $${(d.profit || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}<br/>
                 Biên LN: ${(d.profitMargin || 0).toFixed(1)}%<br/>
                 Số lượng: ${d.quantity || 'N/A'}<br/>
                 CK TB: ${(d.avgDiscount || 0).toFixed(1)}%<br/>
                 Phí Ship TB: $${(d.avgShippingCost || 0).toFixed(2)}`
            )
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() { tooltipElement.transition().duration(300).style("opacity", 0); });
        // --- KẾT THÚC CODE D3.JS ---

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q4 (Treemap): ${error.message}</p>`);
        console.error("Lỗi drawChartQ4:", error);
    }
}